package com.rewear.api.garment;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rewear.api.garment.GarmentDtos.AvailabilityRequest;
import com.rewear.api.garment.GarmentDtos.LifecycleRequest;
import com.rewear.api.garment.GarmentDtos.SaveRequest;

@RestController
@RequestMapping("/api/garments")
public class GarmentController {
    private final GarmentService garments;

    public GarmentController(GarmentService garments) {
        this.garments = garments;
    }

    @GetMapping
    public List<Map<String, Object>> browse(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String size,
        @RequestParam(required = false) Integer maxPrice,
        @RequestParam(required = false, defaultValue = "50") Integer limit,
        @RequestParam(required = false, defaultValue = "0") Integer offset) {
        return garments.browse(q, category, size, maxPrice, limit, offset);
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) {
        return garments.mine(jwt);
    }

    @GetMapping("/saved")
    public List<String> saved(@AuthenticationPrincipal Jwt jwt) {
        return garments.savedIds(jwt);
    }

    @PutMapping("/{id}/saved")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        garments.save(jwt, id);
    }

    @DeleteMapping("/{id}/saved")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsave(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        garments.unsave(jwt, id);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return garments.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveRequest request) {
        return garments.create(jwt, request);
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody SaveRequest request) {
        return garments.update(jwt, id, request);
    }

    @PatchMapping("/{id}/availability")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setAvailability(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody AvailabilityRequest request) {
        garments.setAvailability(jwt, id, request.available());
    }

    @PatchMapping("/{id}/lifecycle")
    public Map<String, Object> updateLifecycle(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                               @Valid @RequestBody LifecycleRequest request) {
        return garments.updateLifecycle(jwt, id, request);
    }

    @GetMapping("/{id}/lifecycle")
    public List<Map<String, Object>> lifecycleHistory(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return garments.lifecycleHistory(jwt, id);
    }
}
