<?php
/**
 * Plugin Name:       Nota MEI Gateway
 * Plugin URI:        https://notameigateway.com.br
 * Description:       Emissão automática de NFS-e para MEI via Nota MEI Gateway. Configure em WooCommerce → Nota MEI.
 * Version:           1.0.0
 * Author:            ScantelburyDevs
 * Author URI:        https://scantelburydevs.com
 * License:           MIT
 * Text Domain:       notamei-gateway
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * WC requires at least: 8.0
 * WC tested up to:   9.9
 */

defined( 'ABSPATH' ) || exit;

define( 'NOTAMEI_VERSION', '1.0.0' );
define( 'NOTAMEI_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'NOTAMEI_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'NOTAMEI_API_DEFAULT_URL', 'https://api.notameigateway.com.br' );

add_action( 'plugins_loaded', 'notamei_gateway_init' );

function notamei_gateway_init() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', static function () {
			echo '<div class="error"><p>'
				. esc_html__( 'Nota MEI Gateway requer WooCommerce ativo.', 'notamei-gateway' )
				. '</p></div>';
		} );
		return;
	}

	require_once NOTAMEI_PLUGIN_DIR . 'includes/class-notamei-api.php';
	require_once NOTAMEI_PLUGIN_DIR . 'includes/class-notamei-order.php';
	require_once NOTAMEI_PLUGIN_DIR . 'includes/class-notamei-admin.php';
	require_once NOTAMEI_PLUGIN_DIR . 'includes/class-notamei-webhook.php';

	NotaMEI_Admin::init();
	NotaMEI_Order::init();
	NotaMEI_Webhook::init();
}

// Declare HPOS compatibility.
add_action( 'before_woocommerce_init', static function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
			'custom_order_tables',
			__FILE__,
			true
		);
	}
} );
