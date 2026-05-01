<?php

defined( 'ABSPATH' ) || exit;

class NotaMEI_Webhook {

	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	public static function register_routes() {
		register_rest_route(
			'notamei/v1',
			'/webhook',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ __CLASS__, 'handle' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	/**
	 * Process an incoming Nota MEI webhook callback.
	 * Endpoint: POST /wp-json/notamei/v1/webhook
	 */
	public static function handle( WP_REST_Request $request ) {
		$raw_body = $request->get_body();

		// Verify HMAC-SHA256 signature when a secret is configured.
		$secret = get_option( 'notamei_webhook_secret', '' );
		if ( ! empty( $secret ) ) {
			$signature = $request->get_header( 'x-notamei-signature' )
				?: $request->get_header( 'x-signature' );

			if ( ! NotaMEI_API::verify_webhook_signature( $raw_body, (string) $signature, $secret ) ) {
				return new WP_REST_Response(
					[ 'error' => 'FORBIDDEN', 'message' => 'Assinatura inválida.' ],
					403
				);
			}
		}

		$payload = json_decode( $raw_body, true );
		if ( ! is_array( $payload ) || empty( $payload['nota_id'] ) ) {
			return new WP_REST_Response(
				[ 'error' => 'BAD_REQUEST', 'message' => 'Payload inválido ou nota_id ausente.' ],
				400
			);
		}

		$nota_id = sanitize_text_field( $payload['nota_id'] );
		$event   = sanitize_text_field( $payload['event'] ?? '' );
		$status  = sanitize_text_field( $payload['status'] ?? '' );

		// Find the WooCommerce order that holds this nota_id in meta.
		$orders = wc_get_orders( [
			'meta_key'   => '_notamei_nota_id',
			'meta_value' => $nota_id,
			'limit'      => 1,
		] );

		if ( empty( $orders ) ) {
			// Acknowledge the event even if not found — avoids infinite retries.
			return new WP_REST_Response( [ 'received' => true, 'matched' => false ], 200 );
		}

		$order    = $orders[0];
		$order_id = $order->get_id();

		update_post_meta( $order_id, '_notamei_status', $status );

		switch ( $event ) {
			case 'nfse.autorizada':
				$numero   = sanitize_text_field( $payload['numero_nfse'] ?? '' );
				$pdf_url  = esc_url_raw( $payload['pdf_url'] ?? '' );
				$xml_url  = esc_url_raw( $payload['xml_url'] ?? '' );
				$emitida  = sanitize_text_field( $payload['emitida_em'] ?? '' );
				$cod_ver  = sanitize_text_field( $payload['codigo_verificacao'] ?? '' );

				update_post_meta( $order_id, '_notamei_numero_nfse', $numero );
				update_post_meta( $order_id, '_notamei_pdf_url', $pdf_url );
				update_post_meta( $order_id, '_notamei_xml_url', $xml_url );
				update_post_meta( $order_id, '_notamei_emitida_em', $emitida );
				update_post_meta( $order_id, '_notamei_codigo_verificacao', $cod_ver );

				$order->add_order_note( sprintf(
					'[Nota MEI] NFS-e AUTORIZADA. Número: %s | Verificação: %s | PDF: %s',
					$numero,
					$cod_ver,
					$pdf_url
				) );
				break;

			case 'nfse.rejeitada':
				$err_code = sanitize_text_field( $payload['erro_codigo'] ?? '' );
				$err_desc = sanitize_text_field( $payload['erro_descricao'] ?? '' );

				update_post_meta( $order_id, '_notamei_erro_codigo', $err_code );
				update_post_meta( $order_id, '_notamei_erro_descricao', $err_desc );

				$order->add_order_note( sprintf(
					'[Nota MEI] NFS-e REJEITADA [%s]: %s',
					$err_code,
					$err_desc
				) );
				break;

			case 'nfse.cancelada':
				$order->add_order_note( __( '[Nota MEI] NFS-e CANCELADA.', 'notamei-gateway' ) );
				break;
		}

		return new WP_REST_Response( [ 'received' => true ], 200 );
	}
}
