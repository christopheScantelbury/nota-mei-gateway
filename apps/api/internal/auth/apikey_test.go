package auth

import (
	"strings"
	"testing"
)

func TestGenerateKey_LivePrefix(t *testing.T) {
	key, hash, err := GenerateKey(true)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	if !strings.HasPrefix(key, PrefixLive) {
		t.Errorf("live key should start with %q, got %q", PrefixLive, key[:12])
	}
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64", len(hash))
	}
	// The hash stored in DB must match a fresh hash of the key.
	if HashKey(key) != hash {
		t.Error("HashKey(key) != hash returned by GenerateKey")
	}
}

func TestGenerateKey_TestPrefix(t *testing.T) {
	key, _, err := GenerateKey(false)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	if !strings.HasPrefix(key, PrefixTest) {
		t.Errorf("test key should start with %q, got %q", PrefixTest, key[:12])
	}
}

func TestGenerateKey_Uniqueness(t *testing.T) {
	k1, _, _ := GenerateKey(true)
	k2, _, _ := GenerateKey(true)
	if k1 == k2 {
		t.Error("two generated keys are identical — RNG broken?")
	}
}

func TestHashKey_Deterministic(t *testing.T) {
	const raw = "sk_live_abc123"
	h1 := HashKey(raw)
	h2 := HashKey(raw)
	if h1 != h2 {
		t.Errorf("HashKey is not deterministic: %q vs %q", h1, h2)
	}
}

func TestHashKey_DifferentInputs(t *testing.T) {
	if HashKey("sk_live_aaa") == HashKey("sk_live_bbb") {
		t.Error("different keys produced the same hash")
	}
}

func TestIsLive(t *testing.T) {
	cases := []struct {
		key  string
		want bool
	}{
		{"sk_live_abc", true},
		{"sk_test_abc", false},
		{"", false},
		{"sk_live", false}, // too short
	}
	for _, c := range cases {
		if got := IsLive(c.key); got != c.want {
			t.Errorf("IsLive(%q) = %v, want %v", c.key, got, c.want)
		}
	}
}

func TestPrefixOf(t *testing.T) {
	if PrefixOf("sk_live_xyz") != PrefixLive {
		t.Error("PrefixOf live key should return PrefixLive")
	}
	if PrefixOf("sk_test_xyz") != PrefixTest {
		t.Error("PrefixOf test key should return PrefixTest")
	}
}
