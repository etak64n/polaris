/** The name of an R2 bucket. Operations on the whole account, such as listing the buckets, have none. */
export function bucketLabel(name: string): string {
  return name === "" ? "(no bucket)" : name;
}
