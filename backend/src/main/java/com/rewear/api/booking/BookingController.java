package com.rewear.api.booking;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rewear.api.booking.BookingDtos.CreateRequest;
import com.rewear.api.booking.BookingDtos.TransitionRequest;

@RestController
@RequestMapping("/api")
public class BookingController {
    private final BookingService bookings;

    public BookingController(BookingService bookings) {
        this.bookings = bookings;
    }

    @GetMapping("/bookings/mine")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) {
        return bookings.mine(jwt);
    }

    @PostMapping("/garments/{garmentId}/bookings")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID garmentId,
                                      @Valid @RequestBody CreateRequest request) {
        return bookings.create(jwt, garmentId, request);
    }

    @PostMapping("/bookings/{bookingId}/transitions")
    public Map<String, Object> transition(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId,
                                          @Valid @RequestBody TransitionRequest request) {
        return bookings.transition(jwt, bookingId, request.status(), request.photoPaths());
    }
}
