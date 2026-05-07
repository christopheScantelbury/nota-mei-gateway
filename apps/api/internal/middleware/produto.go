package middleware

import (
	"github.com/christopheScantelbury/nota-mei-gateway/api/internal/auth"
	"github.com/gofiber/fiber/v2"
)

// DetectarProduto classifica o produto a partir do contexto de autenticação.
// Deve ser chamado após auth.Middleware para que GetMEI/GetEmpresa estejam disponíveis.
//
// Valores possíveis: MEI_DASHBOARD | ME_DASHBOARD | API_GATEWAY | ADMIN
func DetectarProduto(c *fiber.Ctx) string {
	if empresa := auth.GetEmpresa(c); empresa != nil {
		if empresa.Tipo == "MEI" {
			return "MEI_DASHBOARD"
		}
		return "ME_DASHBOARD"
	}
	if auth.GetMEI(c) != nil {
		return "MEI_DASHBOARD"
	}
	return "API_GATEWAY"
}

// ProdutoMiddleware enriches Fiber locals with the detected product label under
// the key "produto". Use after auth.Middleware.
func ProdutoMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Locals("produto", DetectarProduto(c))
		return c.Next()
	}
}
