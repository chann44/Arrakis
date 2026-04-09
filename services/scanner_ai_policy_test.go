package services

import "testing"

func TestShouldRunAIAnalyzer(t *testing.T) {
	tests := []struct {
		name          string
		envEnabled    bool
		policyEnabled bool
		expected      bool
	}{
		{name: "both enabled", envEnabled: true, policyEnabled: true, expected: true},
		{name: "env disabled", envEnabled: false, policyEnabled: true, expected: false},
		{name: "policy disabled", envEnabled: true, policyEnabled: false, expected: false},
		{name: "both disabled", envEnabled: false, policyEnabled: false, expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := shouldRunAIAnalyzer(tc.envEnabled, tc.policyEnabled)
			if got != tc.expected {
				t.Fatalf("shouldRunAIAnalyzer(%v, %v) = %v, want %v", tc.envEnabled, tc.policyEnabled, got, tc.expected)
			}
		})
	}
}
