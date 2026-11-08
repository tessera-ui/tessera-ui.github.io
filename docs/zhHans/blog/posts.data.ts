import { blogLoader, type Post } from "../../.vitepress/blogPosts";

declare const data: Post[];
export { data };

export default blogLoader("zhHans");
