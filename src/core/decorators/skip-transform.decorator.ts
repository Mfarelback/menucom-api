import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipResponseTransform';

export const SkipResponseTransform = () =>
  SetMetadata(SKIP_TRANSFORM_KEY, true);
