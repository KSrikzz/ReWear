package com.rewear.api.admin;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    public record ClaimDecision(@NotBlank String decision, String note, java.math.BigDecimal approvedAmount) {}
    public record AccountStatusRequest(@NotBlank String status) {}
    private final AdminService admin;
    public AdminController(AdminService admin) { this.admin = admin; }
    @GetMapping("/overview") public Map<String, Object> overview(@AuthenticationPrincipal Jwt jwt) { return admin.overview(jwt); }
    @GetMapping("/users") public List<Map<String, Object>> users(@AuthenticationPrincipal Jwt jwt) { return admin.users(jwt); }
    @PatchMapping("/users/{id}/status") public Map<String, Object> setUserStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody AccountStatusRequest request) { return admin.setUserStatus(jwt, id, request.status()); }
    @GetMapping("/memberships") public List<Map<String, Object>> memberships(@AuthenticationPrincipal Jwt jwt) { return admin.memberships(jwt); }
    @GetMapping("/garments") public List<Map<String, Object>> garments(@AuthenticationPrincipal Jwt jwt) { return admin.garments(jwt); }
    @GetMapping("/rentals") public List<Map<String, Object>> rentals(@AuthenticationPrincipal Jwt jwt) { return admin.rentals(jwt); }
    @GetMapping("/payments") public List<Map<String, Object>> payments(@AuthenticationPrincipal Jwt jwt) { return admin.payments(jwt); }
    @GetMapping("/claims") public List<Map<String, Object>> claims(@AuthenticationPrincipal Jwt jwt) { return admin.claims(jwt); }
    @PatchMapping("/claims/{id}") public Map<String, Object> decide(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ClaimDecision decision) {
        return admin.decide(jwt, id, decision);
    }
    @PatchMapping("/rentals/{id}/resolve") public Map<String, Object> resolveDispute(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @RequestBody Map<String, String> payload) {
        return admin.resolveDispute(jwt, id, payload.getOrDefault("resolution", "completed"));
    }
}
