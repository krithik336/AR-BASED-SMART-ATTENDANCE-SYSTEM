package com.attendance.service;

import com.attendance.dto.vision.CandidateFace;
import com.attendance.dto.vision.EmbedBatchResult;
import com.attendance.dto.vision.EmbedResult;
import com.attendance.dto.vision.HealthStatus;
import com.attendance.dto.vision.MatchResult;
import com.attendance.exception.VisionServiceException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * HTTP client for the Python vision service (FastAPI + InsightFace).
 *
 * Production hardening:
 * <ul>
 *   <li>Connect/read timeouts so a hung vision service never blocks a request.</li>
 *   <li>Bounded retry with exponential backoff for transient failures
 *       (connect errors, HTTP 5xx/429/408).</li>
 *   <li>Batch embedding for multi-photo student registration.</li>
 *   <li>Every failure surfaces as {@link VisionServiceException} mapped to HTTP 503.</li>
 * </ul>
 */
@Service
public class FaceRecognitionClient {

    private static final Logger log = LoggerFactory.getLogger(FaceRecognitionClient.class);

    private static final int MAX_BATCH_FILES = 10;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final int maxAttempts;

    public FaceRecognitionClient(
            @Value("${vision.service.url}") String visionServiceUrl,
            @Value("${vision.service.connect-timeout-ms:3000}") int connectTimeoutMs,
            @Value("${vision.service.read-timeout-ms:30000}") int readTimeoutMs,
            @Value("${vision.service.max-attempts:3}") int maxAttempts,
            ObjectMapper objectMapper) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.objectMapper = objectMapper;

        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .withReadTimeout(Duration.ofMillis(readTimeoutMs));

        ClientHttpRequestFactory requestFactory = ClientHttpRequestFactories.get(settings);

        this.restClient = RestClient.builder()
                .baseUrl(visionServiceUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /** Liveness / model readiness probe. */
    public HealthStatus health() {
        return withRetry("health", () ->
                restClient.get()
                        .uri("/health")
                        .retrieve()
                        .body(HealthStatus.class));
    }

    /** Embed the single best face in one image. */
    public EmbedResult embed(byte[] imageBytes) {
        return withRetry("embed", () ->
                restClient.post()
                        .uri("/embed")
                        .contentType(MediaType.IMAGE_JPEG)
                        .body(imageBytes)
                        .retrieve()
                        .body(EmbedResult.class));
    }

    /**
     * Embed the best face of each uploaded image in a single request.
     * Skips files that the vision service rejects (corrupt/unsupported).
     */
    public List<EmbedResult> embedBatch(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        if (files.size() > MAX_BATCH_FILES) {
            throw new IllegalArgumentException("At most " + MAX_BATCH_FILES + " images can be uploaded at once");
        }

        return withRetry("embed/batch", () -> {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            for (int i = 0; i < files.size(); i++) {
                MultipartFile file = files.get(i);
                builder.part("files", file.getResource())
                        .filename("image-" + i + ".jpg")
                        .contentType(MediaType.IMAGE_JPEG);
            }
            MultiValueMap<String, HttpEntity<?>> body = builder.build();

            EmbedBatchResult result = restClient.post()
                    .uri("/embed/batch")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(EmbedBatchResult.class);

            return result == null ? List.of() : result.results();
        });
    }

    /** Match every face in a frame against the enrolled gallery. */
    public MatchResult match(byte[] imageBytes, List<CandidateFace> candidates, double threshold) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("image_base64", Base64.getEncoder().encodeToString(imageBytes));
        payload.put("candidates", candidates);
        payload.put("threshold", threshold);

        return withRetry("match", () -> {
            String body;
            try {
                body = objectMapper.writeValueAsString(payload);
            } catch (JsonProcessingException ex) {
                throw new VisionServiceException("Failed to serialize match payload", ex);
            }
            return restClient.post()
                    .uri("/match")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(MatchResult.class);
        });
    }

    /**
     * Executes an idempotent vision call with bounded retries.
     * GETs and deterministic POSTs (a single frame, a fixed batch) are safe to
     * retry because the payload is identical on each attempt.
     */
    private <T> T withRetry(String operation, Supplier<T> action) {
        int attempt = 1;
        while (true) {
            try {
                return action.get();
            } catch (VisionServiceException ex) {
                throw ex;
            } catch (RestClientException ex) {
                if (!isRetryable(ex) || attempt >= maxAttempts) {
                    log.error("Vision service '{}' failed after {} attempt(s): {}", operation, attempt, ex.getMessage());
                    throw new VisionServiceException("Face recognition service is unavailable", ex);
                }
                log.warn("Vision service '{}' attempt {}/{} failed ({}); retrying in {}ms",
                        operation, attempt, maxAttempts, ex.getClass().getSimpleName(), backoffMs(attempt));
                sleep(backoffMs(attempt));
                attempt++;
            }
        }
    }

    private boolean isRetryable(RestClientException ex) {
        if (ex instanceof ResourceAccessException) {
            return true; // connect/read timeout or unreachable service
        }
        if (ex instanceof HttpStatusCodeException statusEx) {
            HttpStatusCode status = statusEx.getStatusCode();
            return status.is5xxServerError()
                    || status.value() == 408  // request timeout
                    || status.value() == 429; // too many requests
        }
        return false;
    }

    private long backoffMs(int attempt) {
        return Math.min(500L * (1L << (attempt - 1)), 4_000L);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new VisionServiceException("Retry interrupted", ex);
        }
    }
}
