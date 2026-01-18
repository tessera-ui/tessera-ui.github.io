---
title: Image
order: 11
---

# Image

```rust
pub fn image(args: impl Into<ImageArgs>)
```

The `image` component is used to display images.

Notably, the `image` component itself does not own image data; instead it references image data via an `Arc<ImageData>` passed in through `ImageArgs`.

The `ImageData` must be loaded via `tessera_components::image::load_image_from_source`, with the following definition:

```rust
pub fn load_image_from_source(
    source: &ImageSource,
) -> Result<ImageData, ImageError>;

pub enum ImageSource {
    Path(String),
    Bytes(Arc<[u8]>),
}
```

## Examples

Below is an example that loads embedded binary image data into `ImageData`:

```rust
use std::sync::Arc;
use tessera_components::image::{
    image, load_image_from_source, ImageArgsBuilder, ImageSource,
};

// In a real app, you might load image bytes from a file at runtime.
// For this example, we include the bytes at compile time.
let image_bytes = Arc::new(*include_bytes!("../../assets/counter.png"));
let image_data = load_image_from_source(&ImageSource::Bytes(image_bytes))
    .expect("Failed to load image");

// Render the image using its loaded data.
image(image_data);
```

## Arguments

- `args: impl Into<ImageArgs>`

  This argument configures the `image` component, including image data, component size, and other properties. You can use `ImageArgsBuilder` to construct it.

## Preview

![image](/image_example.png)

