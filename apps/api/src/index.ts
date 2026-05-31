export type ApiStatus = {
  service: "api";
  status: "ready";
};

export function getApiStatus(): ApiStatus {
  return {
    service: "api",
    status: "ready"
  };
}
