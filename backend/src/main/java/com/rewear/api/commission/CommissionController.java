package com.rewear.api.commission;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commission")
public class CommissionController {
    private final CommissionService commission;

    public CommissionController(CommissionService commission) {
        this.commission = commission;
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal Jwt jwt) {
        return commission.mine(jwt);
    }

    @GetMapping("/policy")
    public Map<String, Object> policy(@AuthenticationPrincipal Jwt jwt) {
        return commission.policy(jwt);
    }
}
