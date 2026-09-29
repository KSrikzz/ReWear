package com.rewear.api.recommendation;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rewear.api.recommendation.RecommendationDtos.DiscoveryRequest;
import com.rewear.api.recommendation.RecommendationDtos.PreferenceRequest;

@Validated
@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {
    private final RecommendationService recommendations;

    public RecommendationController(RecommendationService recommendations) {
        this.recommendations = recommendations;
    }

    @PostMapping("/discover")
    public Map<String, Object> discover(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DiscoveryRequest request) {
        return recommendations.discover(jwt, request);
    }

    @GetMapping("/style-match")
    public List<Map<String, Object>> styleMatch(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) @Min(0) @Max(1000000) Integer budget,
        @RequestParam(required = false) String size,
        @RequestParam(required = false) String area) {
        return recommendations.styleMatch(jwt, category, budget, size, area);
    }

    @GetMapping("/preferences")
    public Map<String, Object> preferences(@AuthenticationPrincipal Jwt jwt) {
        return recommendations.getPreferences(jwt);
    }

    @PutMapping("/preferences")
    public Map<String, Object> savePreferences(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PreferenceRequest request) {
        return recommendations.savePreferences(jwt, request);
    }

    @DeleteMapping("/preferences")
    public void clearPreferences(@AuthenticationPrincipal Jwt jwt) {
        recommendations.clearPreferences(jwt);
    }
}
