import { getAllBlogsFromSanity } from "./sanity";

export const getAllBlogs = async () => {
  const allBLogsFromSanity = await getAllBlogsFromSanity({
    isAllBlogPage: true,
  });
  return allBLogsFromSanity;
};
