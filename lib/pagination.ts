/** Read every page, including an exact-full final page, and propagate failures. */
export async function readAllPages<T>(
  fetchPage: (page: number, size: number) => PromiseLike<{data: T[] | null; error: unknown}>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const result = await fetchPage(page, pageSize);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return rows;
  }
}
