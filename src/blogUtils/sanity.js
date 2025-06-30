import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: "9sed75bn",
  dataset: "production",
  apiVersion: "2024-03-11",
  useCdn: true,
});

//Blogs and Case studies

export async function getPosts() {
  const posts = await client.fetch('*[_type == "post"]');
  return posts;
}

export async function getAllPostHeaders(category) {
  const latestTag =
    await client.fetch(`*[_type == "tag" && title =="Top Blogs"][0]{
    title,
    posts[] -> {
      title
    }
  }`);
  let newPosts = latestTag.posts.map((post) => {
    return post.title;
  });

  const posts = await client.fetch(`*[_type == "post"] {
    title,
    "imageUrl": mainImage.asset->url,
    slug,
    category->{title, name},
    meta_description,
    publishedAt
  }`);
  let allPosts = posts?.filter((post) => {
    return post?.category?.name === category;
  });

  let topPosts = allPosts.filter((post) => {
    return post?.category?.name === category && newPosts.includes(post.title);
  });
  let remainingPosts = allPosts.filter((post) => {
    return post?.category?.name === category && !newPosts.includes(post.title);
  });
  return topPosts.concat(remainingPosts);
}

export async function getCurrentPost(slug) {
  const posts = await client.fetch(
    `*[_type == "post" && slug.current == "${slug}"][0]{
        title, 
        publishedAt, 
        "imageUrl": mainImage.asset->url, 
        description, 
        meta_description, 
        meta_title, 
        body, 
        author ->{ name, "imageUrl": image->url, linkedin},
        coauthors[] ->{name, "imageUrl": image->url, linkedin},
        statistics, 
        categories[]->{
          title
        }
      }`
  );
  return posts;
}

export async function getSlugs(category) {
  const slugs = await client.fetch(
    '*[_type == "post"]{slug, category->{title, name}}'
  );
  return slugs?.filter((slug) => {
    return slug?.category?.name === category;
  });
}

// Case Studies
export async function getLatestPosts() {
  const latestTag =
    await client.fetch(`*[_type == "tag" && title =="Latest Case Studies"][0]{
    title,
    posts[] -> {
      title, 
      "imageUrl": mainImage.asset->url,
      "slug": slug.current,
      author ->{name, "imageUrl": image->url, linkedin},
      coauthors[] ->{name, "imageUrl": image->url, linkedin},
      publishedAt
    }
  }`);
  return latestTag.posts;
}

// Blogs

export async function getLatestBlogs() {
  const latestTag =
    await client.fetch(`*[_type == "tag" && title =="Latest Blog"][0]{
    title,
    posts[] -> {
      title, 
      "imageUrl": mainImage.asset->url,
      "slug": slug.current,
      region[] -> {name, "slug": slug.current},
      meta_description,
      author ->{name, "imageUrl": image->url, linkedin},
      coauthors[] ->{name, "imageUrl": image->url, linkedin},
      publishedAt
    }
  }`);
  return latestTag.posts;
}

export async function getTrendingBlogs() {
  const trendingBlogs =
    await client.fetch(`*[_type == "blog_tag" && name =="trending"][0]{
    title,
      name,
    blogs[] -> {
      title,
    slug,
    url,
    author -> { name, linkedin, "imageUrl": image.asset->url},
    coauthors[] ->{name, "imageUrl": image.asset->url, linkedin},
    region[] -> {name, "slug": slug.current},
    language[] -> {name},
    "coverImage": {
      "alt" : mainImage.altText,
      "url": mainImage.asset -> url
    },
    category->{title, name},
    statistics,
    meta_description,
    meta_title,
    publishedAt,
    body,
    block,
    "bodyCharacterLength": round(length(pt::text(body))),
    "blockCharacterLength": round(length((block))),
    description,
    should_hide
    }
  }`);
  const convertedBlogs = trendingBlogs.blogs.map((blog) => {
    return convertAttribute(blog);
  });

  return convertedBlogs;
}

export async function getRegions() {
  const regions = await client.fetch(`*[_type == "region"]{
    name,
    "slug": slug.current,
    "imageUrl": image.asset->url
  }`);
  return regions;
}
export async function getLanguages() {
  const languages =
    await client.fetch(`*[_type == "language"] | order(_createdAt desc) {
  name,
  slug
}
`);
  return languages.map((lang) => ({
    name: lang.name,
    title: lang.slug.current,
  }));
}

export async function getNewsArticles() {
  let newsArticles = await client.fetch(`*[_type == "newsroom"]{
    title,
    description,
    url,
    slug,
    body,
    newsroom_category -> {name, title},
    "image": mainImage.asset -> url,
    publishedAt,
    "bodyCharacterLength": round(length(pt::text(body))),
    "blockCharacterLength": round(length((block))),
  }`);
  newsArticles = newsArticles.sort((a, b) => {
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
  return formatArticle(newsArticles);
}

export async function getCurrentNewsroomArticle(slug) {
  const newsArticle = await client.fetch(
    `*[_type == "newsroom" && slug.current == "${slug}"][0]{
    title,
    slug,
    "coverImage": {
      "alt" : mainImage.altText,
      "url": mainImage.asset -> url
    },
    newsroom_category -> {name, title},
    meta_description,
    meta_title,
    publishedAt,
    body,
    description,
     "bodyCharacterLength": round(length(pt::text(body))),
    }`
  );

  const convertedArticle = convertNewsroomAttribute(newsArticle);
  return convertedArticle;
}

function formatArticle(articles) {
  let formatted = articles.map((article) => {
    article.publishedAt =
      article.newsroom_category?.name == "industry-accolades"
        ? new Date(article.publishedAt)
            .toDateString()
            .split(" ")
            .slice(3)
            .join(" ")
        : new Date(article.publishedAt)
            .toDateString()
            .split(" ")
            .slice(1)
            .join(" ");
    article.readTime = `${Math.round(
      ((article?.bodyCharacterLength ?? 0) +
        (article?.blockCharacterLength ?? 0)) /
        5 /
        180
    )} min read`;
    article.image = formatImage(article.image);
    return article;
  });
  return formatted;
}

export async function getCurrentBlogSanity(slug) {
  const blog = await client.fetch(
    `*[_type == "blog" && slug.current == "${slug}"][0]{
    title,
    slug,
    summary,
    author -> { name, linkedin, "imageUrl": image.asset->url },
    coauthors[] ->{name, "imageUrl": image.asset->url, linkedin},
    region[] -> {name, "slug": slug.current},
    language[] -> {name, "slug": slug.current},
    "alternateLanguageVersion": alternateLanguageVersion.blog->{
      title,
      "slug": slug.current,
      language[] -> {name, "slug": slug.current},
      region[] -> {name, "slug": slug.current}
    },
    "coverImage": {
      "alt" : mainImage.altText,
      "url": mainImage.asset -> url
    },
    category->{title, name},
    statistics,
    meta_description,
    meta_title,
    publishedAt,
    _updatedAt,
    body,
    block,
    "bodyCharacterLength": round(length(pt::text(body))),
    "blockCharacterLength": round(length((block))),
    description
    }`
  );
  const convertedBlog = convertAttribute(blog);
  return convertedBlog;
}

export async function getAllBlogsFromSanity({ isAllBlogPage = false }) {
  const blogs =
    await client.fetch(`*[_type == "blog" && (!${isAllBlogPage} || should_hide != true)]{
    title,
    slug,
    author -> {  name, linkedin, "imageUrl": image.asset->url},
    coauthors[] ->{name, linkedin, "imageUrl": image.asset->url},
    region[] -> {name, "slug": slug.current},
    language[] -> {name},
    "coverImage": {
      "alt" : mainImage.altText,
      "url": mainImage.asset -> url
    },
    category->{title, name},
    statistics,
    meta_description,
    meta_title,
    publishedAt,
    body,
    block,
    "bodyCharacterLength": round(length(pt::text(body))),
    "blockCharacterLength": round(length((block))),
    description,
    should_hide
    }`);
  blogs.sort((a, b) => {
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
  const convertedBlogs = blogs.map((blog) => {
    return convertAttribute(blog);
  });
  return convertedBlogs;
}

export const formatImage = (url) => {
  if (url && url.includes("sanity")) {
    if (url.includes("?")) {
      return `${url}&auto=format`;
    } else {
      return `${url}?auto=format`;
    }
  }
  return url;
};

const convertAttribute = (attr) => {
  let coAuthors =
    attr?.coauthors?.map((author) => {
      return {
        name: author?.name,
        linkedin: author?.linkedin,
        avatarURL: formatImage(author?.imageUrl) || null,
      };
    }) || [];
  return {
    title: attr?.title,
    imageUrl: formatImage(attr?.coverImage?.url),
    summary: attr?.summary,
    slug: attr?.slug.current,
    meta_title: attr?.meta_title || attr?.title,
    meta_description: attr?.meta_description || attr?.description,
    authors: [
      {
        name: attr?.author?.name,
        linkedin: attr?.author?.linkedin,
        avatarURL: formatImage(attr?.author?.imageUrl),
      },
      ...coAuthors,
    ],
    publishedAt: new Date(attr?.publishedAt)
      .toDateString()
      .split(" ")
      .slice(1)
      .join(" ")
      .replace(/\s\d{2}\s/, " "),
    rawPublishedAt: attr?.publishedAt,
    rawUpdatedAt: attr?._updatedAt,
    region: attr?.region,
    language: attr?.language?.[0].name || "en",
    alternateLanguageVersion: attr?.alternateLanguageVersion
      ? {
          slug: attr.alternateLanguageVersion.slug,
          title: attr.alternateLanguageVersion.title,
          language: attr.alternateLanguageVersion.language?.[0].name || "en",
          region: attr.alternateLanguageVersion.region,
        }
      : null,
    body: attr?.body,
    url: attr?.url,
    blocks: {
      id: `blocks-${attr.__id}`,
      __component: "shared.rich-text",
      body: attr?.block || "",
    },
    // blocksType: typeof attr?.blocks?.[0],
    readTime: `${Math.round(
      ((attr?.bodyCharacterLength ?? 0) + (attr?.blockCharacterLength ?? 0)) /
        5 /
        180
    )} min read`,
  };
};
const convertNewsroomAttribute = (attr) => {
  return {
    title: attr?.title,
    imageUrl: formatImage(attr?.coverImage?.url),
    slug: attr?.slug.current,
    meta_title: attr?.meta_title || attr?.title,
    meta_description: attr?.meta_description || attr?.description,
    publishedAt: new Date(attr?.publishedAt)
      .toDateString()
      .split(" ")
      .slice(1)
      .join(" ")
      .replace(/\s\d{2}\s/, " "),
    body: attr?.body,
    readTime: `${Math.round(
      ((attr?.bodyCharacterLength ?? 0) + (attr?.blockCharacterLength ?? 0)) /
        5 /
        180
    )} min read`,
  };
};

export async function getLatest5Blogs() {
  const blogs = await client.fetch(
    `*[_type == "blog" && should_hide != true] | order(publishedAt desc) [0...5] {
      title,
      "slug": slug.current,
      "imageUrl": mainImage.asset->url,
      publishedAt,
      "bodyCharacterLength": round(length(pt::text(body))),
      "blockCharacterLength": round(length((block)))
    }`
  );

  const convertedBlogs = blogs.map((blog) => {
    return {
      title: blog.title,
      slug: blog.slug,
      imageUrl: formatImage(blog.imageUrl),
      publishedAt: new Date(blog.publishedAt)
        .toDateString()
        .split(" ")
        .slice(1)
        .join(" ")
        .replace(/\s\d{2}\s/, " "),
      readTime: `${Math.round(
        ((blog?.bodyCharacterLength ?? 0) + (blog?.blockCharacterLength ?? 0)) /
          5 /
          180
      )} min read`,
    };
  });

  return convertedBlogs;
}
