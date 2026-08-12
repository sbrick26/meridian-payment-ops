/* ---------------------------------------------------------------------------
 * Function: jest.teardown
 * Owner:    payments-platform-team
 * Control:  AU-2   (SOX/PCI: PCI Req. 10; SOX 404 change management)
 * Reviewed: 2026-08-12
 * ------------------------------------------------------------------------- */
'use strict';

module.exports = async function () {
  if (global.__SERVER_PROCESS__) {
    global.__SERVER_PROCESS__.kill('SIGTERM');
  }
};
