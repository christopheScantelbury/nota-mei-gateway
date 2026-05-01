<?php

defined( 'ABSPATH' ) || exit;

class NotaMEI_Order {

	public static function init() {
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'on_payment_complete' ] );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'on_status_completed' ] );

		add_action( 'add_meta_boxes', [ __CLASS__, 'register_meta_boxes' ] );

		add_filter( 'woocommerce_order_actions', [ __CLASS__, 'add_order_action' ] );
		add_action( 'woocommerce_order_action_notamei_emitir', [ __CLASS__, 'manual_emit' ] );
		add_action( 'woocommerce_order_action_notamei_consultar', [ __CLASS__, 'manual_consult' ] );
	}

	// ─── Hooks ───────────────────────────────────────────────────────────────

	public static function on_payment_complete( $order_id ) {
		if ( get_option( 'notamei_emit_trigger', 'payment_complete' ) === 'payment_complete' ) {
			self::emit_for_order( $order_id );
		}
	}

	public static function on_status_completed( $order_id ) {
		if ( get_option( 'notamei_emit_trigger', 'payment_complete' ) === 'completed' ) {
			self::emit_for_order( $order_id );
		}
	}

	public static function manual_emit( $order ) {
		delete_post_meta( $order->get_id(), '_notamei_nota_id' );
		self::emit_for_order( $order->get_id() );
	}

	public static function manual_consult( $order ) {
		$nota_id = get_post_meta( $order->get_id(), '_notamei_nota_id', true );
		if ( ! $nota_id ) {
			$order->add_order_note( __( '[Nota MEI] Nenhuma NFS-e emitida ainda.', 'notamei-gateway' ) );
			return;
		}

		$api    = self::make_api();
		$result = $api->consultar( $nota_id );

		if ( is_wp_error( $result ) ) {
			$order->add_order_note( sprintf(
				'[Nota MEI] Erro ao consultar: %s',
				$result->get_error_message()
			) );
			return;
		}

		self::sync_order_meta_from_detail( $order->get_id(), $result );
		$order->add_order_note( sprintf(
			'[Nota MEI] Status atualizado: %s',
			$result['status'] ?? '—'
		) );
	}

	// ─── Emission core ───────────────────────────────────────────────────────

	public static function emit_for_order( $order_id ) {
		if ( get_option( 'notamei_enabled', 'yes' ) !== 'yes' ) {
			return;
		}

		if ( get_post_meta( $order_id, '_notamei_nota_id', true ) ) {
			return; // Already emitted; use manual_emit to retry.
		}

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$api_key = get_option( 'notamei_api_key', '' );
		if ( empty( $api_key ) ) {
			$order->add_order_note( __( '[Nota MEI] API Key não configurada. Acesse WooCommerce → Nota MEI.', 'notamei-gateway' ) );
			return;
		}

		$servico = self::build_servico( $order );
		$tomador = self::build_tomador( $order );

		if ( is_wp_error( $tomador ) ) {
			$order->add_order_note( sprintf(
				'[Nota MEI] Emissão ignorada — %s',
				$tomador->get_error_message()
			) );
			return;
		}

		$api    = self::make_api();
		$result = $api->emitir(
			$servico,
			$tomador,
			gmdate( 'Y-m' ),
			rest_url( 'notamei/v1/webhook' ),
			'woo-order-' . $order_id
		);

		if ( is_wp_error( $result ) ) {
			$code    = $result->get_error_code();
			$message = $result->get_error_message();
			$order->add_order_note( sprintf( '[Nota MEI] Falha na emissão [%s]: %s', $code, $message ) );
			update_post_meta( $order_id, '_notamei_status', 'ERRO_EMISSAO' );
			update_post_meta( $order_id, '_notamei_erro_codigo', $code );
			update_post_meta( $order_id, '_notamei_erro_descricao', $message );
			return;
		}

		$nota_id = isset( $result['nota_id'] ) ? sanitize_text_field( $result['nota_id'] ) : '';
		update_post_meta( $order_id, '_notamei_nota_id', $nota_id );
		update_post_meta( $order_id, '_notamei_status', $result['status'] ?? 'PROCESSANDO' );
		update_post_meta( $order_id, '_notamei_raw', wp_json_encode( $result ) );

		$order->add_order_note( sprintf(
			'[Nota MEI] NFS-e enviada para processamento. Nota ID: %s',
			$nota_id
		) );
	}

	// ─── Data builders ───────────────────────────────────────────────────────

	private static function build_servico( $order ) {
		$template = get_option( 'notamei_discriminacao_template', 'Serviços digitais — Pedido #{order_id}' );
		$desc     = str_replace( '{order_id}', (string) $order->get_id(), $template );

		return [
			'codigo_nbs'    => get_option( 'notamei_default_nbs', '01.01.01.10' ),
			'discriminacao' => $desc,
			'valor'         => (float) $order->get_total(),
			'aliquota_iss'  => (float) get_option( 'notamei_default_aliquota', '2.0' ),
		];
	}

	/**
	 * Build tomador from order billing data.
	 * Requires _billing_cnpj or _billing_cpf meta (populated by CPF/CNPJ checkout fields).
	 *
	 * @return array|WP_Error
	 */
	private static function build_tomador( $order ) {
		$order_id = $order->get_id();

		$first = $order->get_billing_first_name();
		$last  = $order->get_billing_last_name();
		$name  = trim( $first . ' ' . $last );
		if ( empty( $name ) ) {
			$name = $order->get_billing_company() ?: __( 'Cliente', 'notamei-gateway' );
		}

		$cnpj = preg_replace( '/\D/', '', (string) get_post_meta( $order_id, '_billing_cnpj', true ) );
		$cpf  = preg_replace( '/\D/', '', (string) get_post_meta( $order_id, '_billing_cpf', true ) );

		$email = $order->get_billing_email();

		if ( strlen( $cnpj ) === 14 ) {
			return array_filter( [
				'tipo'         => 'PJ',
				'documento'    => $cnpj,
				'razao_social' => $name,
				'email'        => $email ?: null,
			] );
		}

		if ( strlen( $cpf ) === 11 ) {
			return array_filter( [
				'tipo'         => 'PF',
				'documento'    => $cpf,
				'razao_social' => $name,
				'email'        => $email ?: null,
			] );
		}

		if ( get_option( 'notamei_fallback_sem_cpf', 'skip' ) === 'skip' ) {
			return new WP_Error(
				'missing_document',
				'CPF/CNPJ ausente nos metadados do pedido (_billing_cpf ou _billing_cnpj). Emissão ignorada.'
			);
		}

		// "anonymous" fallback: emit without a document (test environments only).
		return [
			'tipo'         => 'PF',
			'documento'    => '00000000000',
			'razao_social' => $name,
		];
	}

	// ─── Meta sync ───────────────────────────────────────────────────────────

	public static function sync_order_meta_from_detail( $order_id, array $detail ) {
		$map = [
			'status'            => '_notamei_status',
			'numero_nfse'       => '_notamei_numero_nfse',
			'emitida_em'        => '_notamei_emitida_em',
			'protocolo_receita' => '_notamei_protocolo',
			'codigo_verificacao'=> '_notamei_codigo_verificacao',
			'erro_codigo'       => '_notamei_erro_codigo',
			'erro_descricao'    => '_notamei_erro_descricao',
		];
		foreach ( $map as $api_field => $meta_key ) {
			if ( isset( $detail[ $api_field ] ) ) {
				update_post_meta( $order_id, $meta_key, sanitize_text_field( (string) $detail[ $api_field ] ) );
			}
		}
	}

	// ─── Admin UI ────────────────────────────────────────────────────────────

	public static function register_meta_boxes() {
		foreach ( [ 'shop_order', 'woocommerce_page_wc-orders' ] as $screen ) {
			add_meta_box(
				'notamei_nfse_info',
				__( 'NFS-e — Nota MEI Gateway', 'notamei-gateway' ),
				[ __CLASS__, 'render_meta_box' ],
				$screen,
				'side',
				'default'
			);
		}
	}

	public static function render_meta_box( $post_or_order ) {
		$order_id = is_a( $post_or_order, 'WC_Order' )
			? $post_or_order->get_id()
			: $post_or_order->ID;

		$nota_id  = get_post_meta( $order_id, '_notamei_nota_id', true );
		$status   = get_post_meta( $order_id, '_notamei_status', true );
		$numero   = get_post_meta( $order_id, '_notamei_numero_nfse', true );
		$emitida  = get_post_meta( $order_id, '_notamei_emitida_em', true );
		$protocolo = get_post_meta( $order_id, '_notamei_protocolo', true );
		$err_code = get_post_meta( $order_id, '_notamei_erro_codigo', true );
		$err_desc = get_post_meta( $order_id, '_notamei_erro_descricao', true );

		if ( ! $nota_id ) {
			echo '<p>' . esc_html__( 'NFS-e não emitida.', 'notamei-gateway' ) . '</p>';
			return;
		}

		$status_color = [
			'AUTORIZADA'   => '#00C85A',
			'PROCESSANDO'  => '#F0B414',
			'REJEITADA'    => '#FF3232',
			'CANCELADA'    => '#6473A0',
			'ERRO_EMISSAO' => '#FF3232',
		];
		$color = isset( $status_color[ $status ] ) ? $status_color[ $status ] : '#6473A0';

		echo '<table style="width:100%;font-size:12px;border-collapse:collapse;">';

		printf(
			'<tr><th style="text-align:left;padding:3px 0;">%s</th>'
			. '<td><strong style="color:%s">%s</strong></td></tr>',
			esc_html__( 'Status', 'notamei-gateway' ),
			esc_attr( $color ),
			esc_html( $status )
		);

		printf(
			'<tr><th style="text-align:left;padding:3px 0;">%s</th><td style="word-break:break-all;font-size:10px">%s</td></tr>',
			esc_html__( 'Nota ID', 'notamei-gateway' ),
			esc_html( $nota_id )
		);

		if ( $numero ) {
			printf(
				'<tr><th style="text-align:left;padding:3px 0;">%s</th><td>%s</td></tr>',
				esc_html__( 'Número NFS-e', 'notamei-gateway' ),
				esc_html( $numero )
			);
		}

		if ( $protocolo ) {
			printf(
				'<tr><th style="text-align:left;padding:3px 0;">%s</th><td>%s</td></tr>',
				esc_html__( 'Protocolo', 'notamei-gateway' ),
				esc_html( $protocolo )
			);
		}

		if ( $emitida ) {
			printf(
				'<tr><th style="text-align:left;padding:3px 0;">%s</th><td>%s</td></tr>',
				esc_html__( 'Emitida em', 'notamei-gateway' ),
				esc_html( $emitida )
			);
		}

		if ( $err_code ) {
			printf(
				'<tr><th style="text-align:left;padding:3px 0;color:#FF3232">%s</th>'
				. '<td style="color:#FF3232">%s</td></tr>',
				esc_html( $err_code ),
				esc_html( $err_desc )
			);
		}

		echo '</table>';
	}

	public static function add_order_action( $actions ) {
		$actions['notamei_emitir']    = __( '[Nota MEI] Emitir / Re-emitir NFS-e', 'notamei-gateway' );
		$actions['notamei_consultar'] = __( '[Nota MEI] Atualizar status da NFS-e', 'notamei-gateway' );
		return $actions;
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────

	private static function make_api() {
		return new NotaMEI_API(
			get_option( 'notamei_api_key', '' ),
			get_option( 'notamei_api_url', NOTAMEI_API_DEFAULT_URL )
		);
	}
}
