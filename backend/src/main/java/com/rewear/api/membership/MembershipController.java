package com.rewear.api.membership;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/memberships")
public class MembershipController {
    public record SelectPlanRequest(@NotBlank String planId) {}

    private final MembershipService memberships;

    public MembershipController(MembershipService memberships) {
        this.memberships = memberships;
    }

    @GetMapping("/plans")
    public List<Map<String, Object>> plans() {
        return memberships.plans();
    }

    @GetMapping("/mine")
    public Map<String, Object> mine(@AuthenticationPrincipal Jwt jwt) {
        return memberships.mine(jwt);
    }

    @PostMapping("/select")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, Object> select(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SelectPlanRequest request) {
        return memberships.select(jwt, request.planId());
    }
}
