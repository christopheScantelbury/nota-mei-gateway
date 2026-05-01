<?php

defined( 'ABSPATH' ) || exit;

class NotaMEI_Admin {

	public static function init() {
		add_filter( 'woocommerce_settings_tabs_array', [ __CLASS__, 'add_settings_tab' ], 50 );
		add_action( 'woocommerce_settings_tabs_notamei', [ __CLASS__, 'output_settings' ] );
		add_action( 'woocommerce_update_options_notamei', [ __CLASS__, 'save_settings' ] );
		add_action( 'woocommerce_settings_tabs_notamei', [ __CLASS__, 'maybe_test_connection' ] );
	}

	public static function add_settings_tab( $tabs ) {
		$tabs['notamei'] = __( 'Nota MEI', 'notamei-gateway' );
		return $tabs;
	}

	public static function output_settings() {
		woocommerce_admin_fields( self::get_settings() );
	}

	public static function save_settings() {
		woocommerce_update_options( self::get_settings() );
	}

	/**
	 * Show a test-connection notice when ?notamei_test=1 is appended to the settings URL.
	 */
	public static function maybe_test_connection() {
		if ( ! isset( $_GET['notamei_test'] ) ) {
			return;
		}

		$api_key = get_option( 'notamei_api_key', '' );
		if ( empty( $api_key ) ) {
			echo '<div class="error"><p>'
				. esc_html__( '[Nota MEI] Configure a API Key antes de testar.', 'notamei-gateway' )
				. '</p></div>';
			return;
		}

		$api    = new NotaMEI_API( $api_key, get_option( 'notamei_api_url', NOTAMEI_API_DEFAULT_URL ) );
		$result = $api->consultar( 'health-check-invalid-id' );

		if ( is_wp_error( $result ) ) {
			$code = $result->get_error_data()['status'] ?? 0;
			if ( $code === 404 ) {
				// 404 means we reached the API and authenticated — healthy.
				echo '<div class="updated"><p>'
					. esc_html__( '[Nota MEI] Conexão com a API OK.', 'notamei-gateway' )
					. '</p></div>';
			} elseif ( $code === 401 ) {
				echo '<div class="error"><p>'
					. esc_html__( '[Nota MEI] API Key inválida ou revogada.', 'notamei-gateway' )
					. '</p></div>';
			} else {
				echo '<div class="error"><p>'
					. esc_html( sprintf( '[Nota MEI] Erro: %s', $result->get_error_message() ) )
					. '</p></div>';
			}
		} else {
			echo '<div class="updated"><p>'
				. esc_html__( '[Nota MEI] Conexão com a API OK.', 'notamei-gateway' )
				. '</p></div>';
		}
	}

	private static function get_settings() {
		return [
			[
				'title' => __( 'Nota MEI Gateway', 'notamei-gateway' ),
				'type'  => 'title',
				'desc'  => sprintf(
					/* translators: %s: URL do painel */
					__( 'Configure sua integração. <a href="%s">Testar conexão →</a>', 'notamei-gateway' ),
					esc_url( add_query_arg( 'notamei_test', '1' ) )
				),
				'id'    => 'notamei_section',
			],
			[
				'title'   => __( 'Ativar emissão automática', 'notamei-gateway' ),
				'type'    => 'checkbox',
				'default' => 'yes',
				'id'      => 'notamei_enabled',
			],
			[
				'title'             => __( 'API Key', 'notamei-gateway' ),
				'type'              => 'password',
				'desc'              => __( 'Chave sk_live_... (produção) ou sk_test_... (sandbox).', 'notamei-gateway' ),
				'id'                => 'notamei_api_key',
				'custom_attributes' => [ 'autocomplete' => 'off' ],
			],
			[
				'title'   => __( 'URL da API', 'notamei-gateway' ),
				'type'    => 'text',
				'default' => NOTAMEI_API_DEFAULT_URL,
				'desc'    => __( 'Não altere em produção.', 'notamei-gateway' ),
				'id'      => 'notamei_api_url',
			],
			[
				'title'             => __( 'Webhook Secret', 'notamei-gateway' ),
				'type'              => 'password',
				'desc'              => __( 'Segredo para validar callbacks. Deixe vazio para desabilitar validação (não recomendado).', 'notamei-gateway' ),
				'id'                => 'notamei_webhook_secret',
				'custom_attributes' => [ 'autocomplete' => 'off' ],
			],
			[
				'type' => 'sectionend',
				'id'   => 'notamei_section_end',
			],

			[
				'title' => __( 'Configurações de emissão', 'notamei-gateway' ),
				'type'  => 'title',
				'id'    => 'notamei_emission_section',
			],
			[
				'title'   => __( 'Disparar ao', 'notamei-gateway' ),
				'type'    => 'select',
				'default' => 'payment_complete',
				'options' => [
					'payment_complete' => __( 'Pagamento confirmado', 'notamei-gateway' ),
					'completed'        => __( 'Pedido marcado como Concluído', 'notamei-gateway' ),
				],
				'id'      => 'notamei_emit_trigger',
			],
			[
				'title'    => __( 'Código NBS', 'notamei-gateway' ),
				'type'     => 'text',
				'default'  => '01.01.01.10',
				'desc_tip' => __( 'Nomenclatura Brasileira de Serviços. Ex: 01.01.01.10 para desenvolvimento de software.', 'notamei-gateway' ),
				'id'       => 'notamei_default_nbs',
			],
			[
				'title'             => __( 'Alíquota ISS (%)', 'notamei-gateway' ),
				'type'              => 'number',
				'default'           => '2.0',
				'custom_attributes' => [ 'step' => '0.01', 'min' => '0', 'max' => '10' ],
				'id'                => 'notamei_default_aliquota',
			],
			[
				'title'   => __( 'Template — discriminação do serviço', 'notamei-gateway' ),
				'type'    => 'text',
				'default' => 'Serviços digitais — Pedido #{order_id}',
				'desc'    => __( 'Variável disponível: {order_id}. Mín. 10 caracteres.', 'notamei-gateway' ),
				'id'      => 'notamei_discriminacao_template',
			],
			[
				'title'   => __( 'Pedido sem CPF/CNPJ', 'notamei-gateway' ),
				'type'    => 'select',
				'default' => 'skip',
				'options' => [
					'skip'      => __( 'Não emitir (recomendado)', 'notamei-gateway' ),
					'anonymous' => __( 'Emitir sem documento (somente ambiente de teste)', 'notamei-gateway' ),
				],
				'desc'    => __( 'Requer campo _billing_cpf ou _billing_cnpj nos metadados do pedido.', 'notamei-gateway' ),
				'id'      => 'notamei_fallback_sem_cpf',
			],
			[
				'type' => 'sectionend',
				'id'   => 'notamei_emission_section_end',
			],
		];
	}
}
