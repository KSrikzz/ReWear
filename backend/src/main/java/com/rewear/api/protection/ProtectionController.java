package com.rewear.api.protection;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/protection")
public class ProtectionController {
    private final ProtectionService protection;
    public ProtectionController(ProtectionService protection) { this.protection = protection; }

    @GetMapping("/terms") public Map<String, Object> terms() { return protection.terms(); }
    @GetMapping("/claims/mine") public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) { return protection.mine(jwt); }
    @PostMapping("/claims/bookings/{bookingId}") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId, @Valid @RequestBody ProtectionDtos.ClaimRequest request) {
        return protection.submit(jwt, bookingId, request);
    }
    @PatchMapping("/claims/{claimId}/response")
    public Map<String, Object> respond(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID claimId, @Valid @RequestBody ProtectionDtos.OwnerResponse request) {
        return protection.respond(jwt, claimId, request);
    }
}
