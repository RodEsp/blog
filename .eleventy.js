const fs = require("fs");
const os = require('os');

const { EleventyHtmlBasePlugin } = require("@11ty/eleventy");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const htmlmin = require("html-minifier");
const { DateTime } = require("luxon");

const getMarkdownContent = (block, indentLevel) => {
  if (!block.content) return '';

  const { children } = block;
  let markdown = `${block.content}${os.EOL}${os.EOL}`;

  let temp;
  children.forEach((block) => {
    temp = `${' '.repeat(indentLevel*2)}- ${getMarkdownContent(block, block.children.length === 0 ? 0 : indentLevel + 1)}`

    // If the block is a multiline code block, we need to add the indent to each line
    if (temp.startsWith(`${' '.repeat(indentLevel*2)}- \`\`\``)) {
      temp = temp.replace(/\n/g, `${os.EOL}${' '.repeat(indentLevel*2 + 2)}`).trimEnd() + os.EOL;
    }
    
    markdown += temp;
  });

  return markdown;
};

const getMarkdown = (block) => {
  let markdown = '';
  const { children , properties } = block;

  markdown += `---${os.EOL}`;
  markdown += `title: ${properties['post-title']}${os.EOL}`;

  if (properties) {
    Object.keys(properties).forEach((key) => {
      if (key !== 'public' && key !== 'page-type' && key !== 'title' && key !== 'post-title' && key !== 'alias') {
        markdown += `${key}: ${properties[key]}${os.EOL}`;
      }
    });
  }

  markdown += `---${os.EOL}${os.EOL}`;

  children.forEach((block) => {
    markdown += getMarkdownContent(block, 0).replace(/\[\[/g, '<span style="color: green">').replace(/\]\]/g, '</span>');
  });
    
  return markdown;
};  

module.exports = (eleventyConfig) => {
  fs.rmSync('_site/blog/', { recursive: true, force: true });
  fs.rmSync('_site/posts/', { recursive: true, force: true });
  fs.rmSync('_site/index.html', { force: true });

  const graph = JSON.parse(fs.readFileSync('src/logseq/logseq_public_graph.json', 'utf8'));

  // Filter logseq graph to only include public pages
  let publicPages = graph.blocks.filter((page) => page.properties?.public === true); 

  // Create map of key:value pairs where keys are page titles and values are their contents in markdown
  let pagesInMarkdown = {};
  for (const page of publicPages) {
    pagesInMarkdown[page['page-name']] = getMarkdown(page);
  }

  // Write each page to a markdown file
  for (const post of Object.values(pagesInMarkdown)) {
    fs.writeFileSync(`src/posts/${post.match(/title:\s(.*)/)[1].replace(/[\s]/g, '-').replace(/\W/g, '')}.md`, post.replace('- Rodrigo','\\- Rodrigo'));
  }
  
  // Disable automatic use of your .gitignore
  eleventyConfig.setUseGitIgnore(false);

  // human readable date
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  // Syntax Highlighting for Code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // Used the /blog path prefix to the entire site
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  // Copy Static Files to /_Site
  eleventyConfig.addPassthroughCopy({
    "./node_modules/alpinejs/dist/cdn.min.js": "./static/js/alpine.js",
    "./node_modules/prismjs/themes/prism-tomorrow.css": "./static/css/prism-tomorrow.css",
  });

  // Copy Image Folder to /_site
  eleventyConfig.addPassthroughCopy("./src/static/img");

  // Copy favicon to route of /_site
  eleventyConfig.addPassthroughCopy("./src/ffavicon.ico");

  // Minify HTML
  eleventyConfig.addTransform("htmlmin", function (content) {
    if (this.page.outputPath.endsWith(".html") && !this.page.inputPath.includes('logseq_public_graph.json')) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
      return minified;
    }

    return content;
  });

  eleventyConfig.addFilter('externalLinks', async (value) => {
    return value.replace(/href="/g, 'target="_blank" href="');
  })

  return {
    dir: {
      input: 'src',
      output: '_site',
    },
    pathPrefix: "/blog/",
    htmlTemplateEngine: "njk"
  };
};