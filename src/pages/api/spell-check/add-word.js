import { createClient } from "@sanity/client";

const token = import.meta.env.SANITY_SECRET_TOKEN;
// Disable static generation for this API endpoint
export const prerender = false;

const client = createClient({
  projectId: "9sed75bn",
  dataset: "production",
  apiVersion: "2024-03-11",
  useCdn: false,
  token: token,
});

console.log(token, "token");

export async function POST({ request }) {
  try {
    const { word } = await request.json();

    if (!word || typeof word !== "string") {
      return new Response(JSON.stringify({ error: "Word is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if word already exists
    const existing = await client.fetch(
      '*[_type == "customWords" && word == $word][0]',
      { word: word }
    );

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Word already exists",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create new custom word document
    const doc = await client.create({
      _type: "customWords",
      word: word,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Word added successfully",
        id: doc._id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error adding word to Sanity:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to add word",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
