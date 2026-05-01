<?php

defined( 'ABSPATH' ) || exit;

class NotaMEI_API {

	private $api_key;
	private $base_url;
	private $timeout;

	public function __construct( $api_key, $base_url = NOTAMEI_API_DEFAULT_URL, $timeout = 30 ) {
		$this->api_key  = $api_key;
		$this->base_url = rtrim( $base_url, '/' );
		$this->timeout  = (int) $timeout;
	}

	/**
	 * Emit a new NFS-e.
	 *
	 * @param array       $servico         { codigo_nbs, discriminacao, valor, aliquota_iss }
	 * @param array       $tomador         { tipo, documento, razao_social, email? }
	 * @param string      $competencia     YYYY-MM
	 * @param string|null $webhook_url
	 * @param string|null $idempotency_key
	 * @return array|WP_Error { nota_id, status, mensagem }
	 */
	public function emitir( array $servico, array $tomador, $competencia, $webhook_url = null, $idempotency_key = null ) {
		$body = [
			'servico'     => $servico,
			'tomador'     => $tomador,
			'competencia' => $competencia,
		];

		if ( $webhook_url ) {
			$body['webhook_url'] = $webhook_url;
		}

		$headers = [];
		if ( $idempotency_key ) {
			$headers['Idempotency-Key'] = $idempotency_key;
		}

		return $this->request( 'POST', '/v1/nfse', $body, $headers );
	}

	/**
	 * Fetch details for an existing NFS-e.
	 *
	 * @param string $nota_id
	 * @return array|WP_Error
	 */
	public function consultar( $nota_id ) {
		return $this->request( 'GET', '/v1/nfse/' . rawurlencode( $nota_id ) );
	}

	/**
	 * Cancel an authorized NFS-e.
	 *
	 * @param string $nota_id
	 * @return array|WP_Error { nota_id, status, mensagem }
	 */
	public function cancelar( $nota_id ) {
		return $this->request( 'DELETE', '/v1/nfse/' . rawurlencode( $nota_id ) );
	}

	/**
	 * Verify HMAC-SHA256 webhook signature (constant-time).
	 *
	 * @param string $raw_body  Raw request body bytes.
	 * @param string $signature Value from X-NotaMEI-Signature header (format: sha256=<hex>).
	 * @param string $secret    Shared webhook secret.
	 * @return bool
	 */
	public static function verify_webhook_signature( $raw_body, $signature, $secret ) {
		if ( strpos( $signature, 'sha256=' ) !== 0 ) {
			return false;
		}
		$expected = 'sha256=' . hash_hmac( 'sha256', $raw_body, $secret );
		return hash_equals( $expected, $signature );
	}

	/**
	 * Perform an HTTP request against the Nota MEI API.
	 *
	 * @param string $method  HTTP verb.
	 * @param string $path    Endpoint path (e.g. /v1/nfse).
	 * @param array  $body    Request body (will be JSON-encoded for non-GET requests).
	 * @param array  $extra   Additional headers.
	 * @return array|WP_Error Decoded JSON response or WP_Error on failure.
	 */
	private function request( $method, $path, $body = null, $extra = [] ) {
		$args = [
			'method'  => $method,
			'timeout' => $this->timeout,
			'headers' => array_merge(
				[
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
					'User-Agent'    => 'notamei-woocommerce/' . NOTAMEI_VERSION,
				],
				$extra
			),
		];

		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( $this->base_url . $path, $args );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code     = (int) wp_remote_retrieve_response_code( $response );
		$body_str = wp_remote_retrieve_body( $response );
		$data     = json_decode( $body_str, true );

		if ( $code >= 400 ) {
			$error_code = isset( $data['error'] ) ? $data['error'] : 'HTTP_' . $code;
			$message    = isset( $data['message'] ) ? $data['message'] : $body_str;
			return new WP_Error(
				strtolower( $error_code ),
				$message,
				[ 'status' => $code, 'data' => $data ]
			);
		}

		return null !== $data ? $data : $body_str;
	}
}
