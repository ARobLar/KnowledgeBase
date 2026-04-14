import { KBIntent, ContentType } from "@/types";

export function formatContent(intent: KBIntent): string {
  if (intent.markdownContent) {
    return intent.markdownContent;
  }

  // Generate fallback content based on type
  const title = intent.title ?? "Untitled";
  const now = new Date().toISOString().split("T")[0];

  switch (intent.contentType) {
    case "recipe":
      return formatRecipe(title, now);
    case "identity":
      return formatIdentity(title, now);
    case "research":
      return formatResearch(title, now);
    case "idea":
      return formatIdea(title, now);
    case "note":
    case "general":
    default:
      return formatNote(title, now);
  }
}

function formatRecipe(title: string, date: string): string {
  return `# ${title}

*Created: ${date}*

## Ingredients

-

## Instructions

1.

## Notes

`;
}

function formatIdentity(title: string, date: string): string {
  return `# ${title}

*Last updated: ${date}*

## Overview

`;
}

function formatResearch(title: string, date: string): string {
  return `# ${title}

*Date: ${date}*

## Summary

## Key Findings

## Sources

`;
}

function formatIdea(title: string, date: string): string {
  return `# ${title}

*Date: ${date}*

## The Idea

## Why It Matters

## Next Steps

`;
}

function formatNote(title: string, date: string): string {
  return `# ${title}

*Date: ${date}*

`;
}

export function contentTypeToFolder(contentType: ContentType): string {
  const map: Record<ContentType, string> = {
    recipe: "recipes",
    identity: "identity",
    research: "research",
    note: "personal",
    idea: "ideas",
    general: "personal",
    unknown: "personal",
  };
  return map[contentType];
}
