import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://pantheon-org.github.io',
  base: '/agentic-context',
  integrations: [
    starlight({
      title: 'Agentic Context Research',
      description: 'Research survey on context management in agentic LLM systems.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/pantheon-org/agentic-context' },
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        PageTitle: './src/components/DocHeader.astro',
      },
      sidebar: [
        {
          label: 'Synthesis',
          link: '/synthesis',
        },
        {
          label: 'Triage Log',
          link: '/triage-log',
        },
        {
          label: 'Analyses',
          autogenerate: { directory: 'analysis' },
        },
        {
          label: 'Benchmarks',
          autogenerate: { directory: 'benchmarks' },
        },
        {
          label: 'References',
          autogenerate: { directory: 'references' },
        },
      ],
    }),
  ],
});
