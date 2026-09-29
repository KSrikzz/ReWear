package com.rewear.api.recommendation;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class MlServiceClient {

    private final RestClient restClient;

    public MlServiceClient(@Value("${rewear.ml-service.url:http://localhost:8000}") String mlServiceUrl) {
        this.restClient = RestClient.builder().baseUrl(mlServiceUrl).build();
    }

    public List<Double> embed(String text) {
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/embed")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("text", text))
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            
            if (response != null && response.containsKey("embedding")) {
                @SuppressWarnings("unchecked")
                List<Double> embedding = (List<Double>) response.get("embedding");
                return embedding;
            }
        } catch (RestClientException e) {
            // Fallback or log error
            System.err.println("ML Service unavailable: " + e.getMessage());
        }
        return null;
    }

    public List<Map<String, Object>> search(String query, List<Map<String, Object>> productEmbeddings, int topK) {
        try {
            Map<String, Object> request = Map.of(
                    "query", query,
                    "product_embeddings", productEmbeddings,
                    "top_k", topK
            );
            Map<String, Object> response = restClient.post()
                    .uri("/search")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            
            if (response != null && response.containsKey("results")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
                return results;
            }
        } catch (RestClientException e) {
            System.err.println("ML Service search unavailable: " + e.getMessage());
        }
        return null;
    }
}
