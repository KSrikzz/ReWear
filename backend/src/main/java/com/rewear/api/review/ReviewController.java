package com.rewear.api.review;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rewear.api.booking.BookingDtos.ReviewRequest;

@RestController
@RequestMapping("/api")
public class ReviewController {
    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    @GetMapping("/garments/{garmentId}/reviews")
    public List<Map<String, Object>> forGarment(@PathVariable UUID garmentId,
        @RequestParam(required = false) Integer rating,
        @RequestParam(defaultValue = "recent") String sort,
        @RequestParam(defaultValue = "false") boolean withImages,
        @AuthenticationPrincipal Jwt jwt) {
        return reviews.forGarment(garmentId, rating, sort, withImages, jwt);
    }

    @GetMapping("/reviews/mine")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) {
        return reviews.mine(jwt);
    }

    @PostMapping("/bookings/{bookingId}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId,
                                      @Valid @RequestBody ReviewRequest request) {
        return reviews.create(jwt, bookingId, request);
    }

    @PostMapping("/reviews/{reviewId}/helpful")
    public Map<String, Object> toggleHelpful(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID reviewId) {
        return reviews.toggleHelpful(jwt, reviewId);
    }
}
