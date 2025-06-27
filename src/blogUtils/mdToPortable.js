import { unified } from "unified";
import frontmatter from "remark-frontmatter";
import extract from "remark-extract-frontmatter";
import markdown from "remark-parse";
import html from "remark-html";
import yaml from "yaml";

export const convertMDtoVFile = async (markdownContent) => {
  const temp123 = await unified()
    .use(markdown)
    .use(frontmatter)
    .use(extract, { name: "frontmatter", yaml: yaml.parse })
    .use(html)
    .process(markdownContent);
  return temp123;
};
