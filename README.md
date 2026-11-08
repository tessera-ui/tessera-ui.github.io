# Tessera website

[Website](https://tessera-ui.github.io/) | [Framework](https://github.com/tessera-ui/tessera)

Source for Tessera's documentation and website.

## Development

Use [Bun](https://bun.sh/) 1.3.14, as pinned in `package.json` and CI.

```sh
bun install --frozen-lockfile
bun run docs:dev      # local development
bun run docs:check    # documentation links and translations
bun run docs:build    # production site
bun run docs:preview  # preview the build
```

## License

Source code: [MIT](LICENSE). Documentation: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
