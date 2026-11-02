// Keep retries finite even when a server repeatedly returns an unusable stream.
export function recoveryBudget() {
  let network = 0;
  let media = 0;
  return (type) => {
    if (type === "networkError" && network < 2)
      return { action: "network", delay: ++network * 1000 };
    if (type === "mediaError" && media++ < 1)
      return { action: "media", delay: 0 };
    return { action: "fail", delay: 0 };
  };
}
