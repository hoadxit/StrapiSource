import { chain } from 'stream-chain';
import { Readable } from 'stream';

import type { IMetadata, ISourceProvider, ProviderType } from '../../../../types';
import { createEntitiesStream, createEntitiesTransformStream } from './entities';
import { createLinksStream } from './links';
import { createConfigurationStream } from './configuration';
import { createAssetsStream } from './assets';
import * as utils from '../../../utils';
import { assertValidStrapi } from '../../../utils/providers';

export interface ILocalStrapiSourceProviderOptions {
  getStrapi(): Strapi.Strapi | Promise<Strapi.Strapi>;

  autoDestroy?: boolean;
}

export const createLocalStrapiSourceProvider = (options: ILocalStrapiSourceProviderOptions) => {
  return new LocalStrapiSourceProvider(options);
};

class LocalStrapiSourceProvider implements ISourceProvider {
  name = 'source::local-strapi';

  type: ProviderType = 'source';

  options: ILocalStrapiSourceProviderOptions;

  strapi?: Strapi.Strapi;

  constructor(options: ILocalStrapiSourceProviderOptions) {
    this.options = options;
  }

  async bootstrap(): Promise<void> {
    this.strapi = await this.options.getStrapi();
  }

  async close(): Promise<void> {
    const { autoDestroy } = this.options;

    // Basically `!== false` but more deterministic
    if (autoDestroy === undefined || autoDestroy === true) {
      await this.strapi?.destroy();
    }
  }

  getMetadata(): IMetadata {
    const strapiVersion = strapi.config.get('info.strapi');
    const createdAt = new Date().toISOString();

    const plugins = Object.keys(strapi.plugins);

    return {
      createdAt,
      strapi: {
        version: strapiVersion,
        plugins: plugins.map((name) => ({
          name,
          // TODO: Get the plugin actual version when it'll be available
          version: strapiVersion,
        })),
      },
    };
  }

  async createEntitiesReadStream(): Promise<Readable> {
    assertValidStrapi(this.strapi, 'Not able to stream entities');

    return chain([
      // Entities stream
      createEntitiesStream(this.strapi),

      // Transform stream
      createEntitiesTransformStream(),
    ]);
  }

  createLinksReadStream(): Readable {
    assertValidStrapi(this.strapi, 'Not able to stream links');

    return createLinksStream(this.strapi);
  }

  createConfigurationReadStream(): Readable {
    assertValidStrapi(this.strapi, 'Not able to stream configuration');

    return createConfigurationStream(strapi);
  }

  getSchemas() {
    assertValidStrapi(this.strapi, 'Not able to get Schemas');

    const schemas = {
      ...this.strapi.contentTypes,
      ...this.strapi.components,
    };

    return utils.schema.mapSchemasValues(schemas);
  }

  createSchemasReadStream(): Readable {
    return Readable.from(Object.values(this.getSchemas()));
  }

  createAssetsReadStream(): Readable {
    assertValidStrapi(this.strapi, 'Not able to stream assets');

    return createAssetsStream(this.strapi);
  }
}

export type ILocalStrapiSourceProvider = InstanceType<typeof LocalStrapiSourceProvider>;
