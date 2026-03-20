/**
 * Swagger UI served as static HTML + CDN assets.
 * Vercel serverless မှာ node_modules/swagger-ui-dist က မပါတတ်လို့
 * swagger-ui-express က css/js ကို HTML အဖြစ် ပြန်ပေးတာမျိုးဖြစ်နိုင်ပါတယ်။
 *
 * Swagger UI: GET /api/docs (သို့) /api/docs/
 * OpenAPI JSON: GET /api/openapi
 */

// Pin major version — CDN မှ တူညီသော swagger-ui-dist
const SWAGGER_UI_DIST_VERSION = "5.11.0";

export function getSwaggerUiHtml(): string {
  const base = `/api/openapi`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HR Supply API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui.css" crossorigin="anonymous" />
  <style>html{box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}body{margin:0}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_DIST_VERSION}/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "${base}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;
}
