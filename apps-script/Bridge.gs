/**
 * PSB Fathan Mubina — Bridge transport helpers
 * Transport-only layer. Business logic remains in Code.gs.
 */

const PSB_BRIDGE_TRANSPORT_VERSION = '33.0.0';

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function bridgeHealthCheck() {
  return {
    ok: true,
    service: 'PSB Bridge',
    version: PSB_BRIDGE_TRANSPORT_VERSION,
    timestamp: new Date().toISOString()
  };
}

function psbBridgeHealth() {
  return bridgeHealthCheck();
}
