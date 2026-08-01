import worker from "../src/index.ts";

const INTERNAL_PATH_PARAMETER = "__rawaj_path";

function restorePublicUrl(request: Request): Request {
  const url = new URL(request.url);
  const publicPath = url.searchParams.get(INTERNAL_PATH_PARAMETER);

  if (publicPath) {
    url.pathname = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;
  }
  url.searchParams.delete(INTERNAL_PATH_PARAMETER);

  return new Request(url, request);
}

export default {
  fetch(request: Request): Promise<Response> {
    return worker.fetch(restorePublicUrl(request));
  },
};
