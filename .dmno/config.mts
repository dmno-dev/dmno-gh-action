/*
  This config is only used to run the action locally for testing!
*/

import { defineDmnoService } from 'dmno';

export default defineDmnoService({
  isRoot: true,
  settings: {
    redactSensitiveLogs: true,
    interceptSensitiveLeakRequests: true,
    preventClientLeaks: true,
  },
  schema: {
    EXAMPLE_STRING: {
      value: 'example-1',
    },
    EXAMPLE_BOOLEAN: {
      value: true,
    },
    EXAMPLE_SENSITIVE: {
      value: () => `secret-${+ new Date()}`,
      sensitive: true,
    },
  },
});
