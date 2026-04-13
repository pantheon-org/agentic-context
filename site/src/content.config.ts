import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // analysis pages
        tool: z
          .object({
            name: z.string(),
            repo: z.string(),
            version: z.string().optional(),
            language: z.string().optional(),
            license: z.string().optional(),
          })
          .optional(),
        reviewed: z.boolean().optional(),
        source_reviewed: z.boolean().optional(),
        reviewed_date: z.coerce.date().nullable().optional(),
        date: z.coerce.date().optional(),
        updated: z.coerce.date().nullable().optional(),
        // shared / benchmark / reference fields (preserve but don't validate strictly)
        type: z.string().optional(),
        outcome: z.string().optional(),
        harness_present: z.boolean().optional(),
        harness_path: z.string().nullable().optional(),
        author: z.string().optional(),
        tags: z.array(z.string()).optional(),
        version: z.string().optional(),
        context: z.string().optional(),
        source: z.union([z.string(), z.array(z.string())]).optional(),
        source_alt: z.string().optional(),
        local_clone: z.string().nullable().optional(),
      }),
    }),
  }),
};
