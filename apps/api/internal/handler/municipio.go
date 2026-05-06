package handler

import (
	"sort"
	"strings"

	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/document"
	"github.com/gofiber/fiber/v2"
)

// MunicipioHandler serves municipality data loaded from the ISS lookup table.
type MunicipioHandler struct {
	issLookup *document.ISSLookup
}

// NewMunicipioHandler creates a MunicipioHandler.
func NewMunicipioHandler(l *document.ISSLookup) *MunicipioHandler {
	return &MunicipioHandler{issLookup: l}
}

// ListMunicipios handles GET /v1/municipios.
// Optional query param ?uf=AM filters by the 2-digit state prefix of the IBGE code.
// Brazilian IBGE municipality codes start with 2 digits identifying the state:
//
//	13 = AM (Amazonas), 35 = SP, 33 = RJ, etc.
//
// Response: {"municipios": [{"ibge": "1302603", "aliquota_iss": 2.0}, ...]}
func (h *MunicipioHandler) ListMunicipios(c *fiber.Ctx) error {
	if h.issLookup == nil {
		return c.JSON(fiber.Map{"municipios": []fiber.Map{}})
	}

	all := h.issLookup.ListAll()

	// Optional UF filter: maps 2-char UF to 2-digit IBGE state prefix.
	if uf := strings.ToUpper(c.Query("uf")); uf != "" {
		prefix, ok := ufToIBGEPrefix[uf]
		if !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error":   "INVALID_UF",
				"message": "UF inválida — use sigla de dois caracteres (ex: AM, SP)",
			})
		}
		filtered := all[:0]
		for _, m := range all {
			if strings.HasPrefix(m.IBGE, prefix) {
				filtered = append(filtered, m)
			}
		}
		all = filtered
	}

	// Sort by IBGE code for deterministic output.
	sort.Slice(all, func(i, j int) bool { return all[i].IBGE < all[j].IBGE })

	items := make([]fiber.Map, 0, len(all))
	for _, m := range all {
		items = append(items, fiber.Map{
			"ibge":        m.IBGE,
			"aliquota_iss": m.Aliquota,
		})
	}

	return c.JSON(fiber.Map{
		"total":      len(items),
		"municipios": items,
	})
}

// ufToIBGEPrefix maps 2-char Brazilian state codes to 2-digit IBGE municipality prefixes.
var ufToIBGEPrefix = map[string]string{
	"RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15",
	"AP": "16", "TO": "17", "MA": "21", "PI": "22", "CE": "23",
	"RN": "24", "PB": "25", "PE": "26", "AL": "27", "SE": "28",
	"BA": "29", "MG": "31", "ES": "32", "RJ": "33", "SP": "35",
	"PR": "41", "SC": "42", "RS": "43", "MS": "50", "MT": "51",
	"GO": "52", "DF": "53",
}
