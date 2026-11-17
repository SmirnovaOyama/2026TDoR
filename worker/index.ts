// Serves the built site from dist/. Only the page itself passes through here: link
// previews need absolute addresses, so the Open Graph and Twitter tags are rewritten
// for the domain the request came to. No domain has to be written into the repo.

interface Env {
  ASSETS: Fetcher;
}

const ABSOLUTE = 'meta[property="og:url"], meta[property="og:image"], meta[name="twitter:image"]';

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;
    const origin = new URL(request.url).origin;
    return new HTMLRewriter()
      .on(ABSOLUTE, {
        element(el) {
          const content = el.getAttribute('content');
          if (content) el.setAttribute('content', new URL(content, origin).href);
        },
      })
      .transform(response);
  },
} satisfies ExportedHandler<Env>;
