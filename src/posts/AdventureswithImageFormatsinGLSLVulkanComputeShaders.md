---
title: Adventures with Image Formats in GLSL Vulkan Compute Shaders
stage: final
date: 2023-04-30
---

TL;DR: In a [Vulkan Compute Shader](https://vulkan-tutorial.com/Compute_Shader), you can actually omit the [image format](https://www.khronos.org/opengl/wiki/Layout_Qualifier_(GLSL)#Image_formats) in the layout declaration for an [image](https://www.khronos.org/opengl/wiki/Image_Load_Store#Image_variables), and it works just fine. Like this:

```
// You don't need to inlude `rgb8` in `layout(set = 0, binding = 0, rgb8)`
layout(set = 0, binding = 0) uniform writeonly image2D img;
```

I've been learning Rust, Vulkan, and GLSL by writing a ray tracer with [Vulkano](https://vulkano.rs/). As I'm relatively new to these technologies, diving in head-first has been my go-to learning method. Needless to say, that often leads to issues where the solution is straightforward, but it takes me ages and a lot of frustration to figure it out. This blog is about such an issue.

Because I don't own an RTX graphics card, if I want to ray trace "real" voxels, I have to use a compute shader. This allows me to skip all the hullabaloo of creating triangle meshes and then rasterizing them. But it also means that my graphics pipeline is kind of weird since compute shaders have to share memory between the GPU and CPU using buffers and then display what gets written into that memory through a Vulkan Swapchain image, as opposed to creating a [Vulkan Graphics Pipeline](https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/vkCreateGraphicsPipelines.html) and writing directly to it the way Vertex or Fragment shaders can.

I didn't know anything about Vulkan [Swap](https://en.wikipedia.org/wiki/Swap_chain)[chains](https://vulkan-tutorial.com/Drawing_a_triangle/Presentation/Swap_chain), [Images](https://registry.khronos.org/vulkan/specs/1.3-extensions/man/html/VkImage.html), or even [GLSL](https://en.wikipedia.org/wiki/OpenGL_Shading_Language) when I started this, so I asked the internet how to do it. But nowhere on the internet, that I could find, did it show that you could skip the image format declaration. In fact, most sources insisted that it was mandatory. So I never considered removing it. And that led to this very frustrating error message:

```
ImageViewFormatMismatch { required: R8G8B8A8_UNORM, provided: Some(B8G8R8A8_UNORM) }
```

After some debugging and research, I discovered that I hadn't specified the `image_format` while creating the Swapchain, causing my GPU (an NVIDIA GeForce GTX 1080) to use a default supported format.

```rust
let (swapchain, images) = Swapchain::new(
  device.clone(),
  Arc::new(surface),
  SwapchainCreateInfo {
      // Not passing in a specific image_format here
      min_image_count: caps.min_image_count,
      image_usage: ImageUsage::STORAGE,
      image_extent: [SCREEN_WIDTH, SCREEN_HEIGHT],
      composite_alpha,
      ..Default::default()
    },
  )
.unwrap();
```

So, I thought, easy enough, I just have to find a compatible image format for both my graphics card and a GLSL Compute Shader.
I figured out how to print all the formats my GPU supports with this code:

```rust
println!("Image Formats: {:?}", physical_device.surface_formats(&surface, Default::default()).unwrap());
```

And that printed out this:
```
Image Formats: [(B8G8R8A8_UNORM, SrgbNonLinear), (B8G8R8A8_SRGB, SrgbNonLinear), (A2B10G10R10_UNORM_PACK32, SrgbNonLinear)]
```
If you're astute or clicked on the image format [link](https://www.khronos.org/opengl/wiki/Layout_Qualifier_(GLSL)#Image_formats) at the top, you'll notice that none of these matches what GLSL compute shaders support. Great.

At this point, I thought I was either A) screwed and needed to buy a new GPU or B) needed to somehow figure out how to enable other image formats in my GPU. And I wasn't going to buy a new GPU on the spot, so I went down a many-hour rabbit hole that proved utterly unsuccessful because you can't magically allow your GPU to support image formats it doesn't. Surprise, surprise.

Feeling desperate, I considered writing the shader in another language, since Vulkan doesn't read GLSL directly. It compiles both GLSL and HLSL shaders into [SPIR-V](https://registry.khronos.org/SPIR-V/) to use them. However, after a brief glance at SPIR-V's docs, I decided no way in hell I was going to try to write that manually. So I started "re-writing" my GLSL into HLSL, but at this point, I was so tired that what I actually did was just randomly mess about with the GLSL shader I had. I was constantly running `cargo run` to make sure that I didn't have any glaring errors in my shader code and to my great surprise, one of those times, everything just worked! There were no errors, and this ray-traced sphere popped up on my screen!

![image.png](../../static/img/green-ray-traced-sphere.png)

It was the most beautiful thing I'd ever seen. But I had no idea why it all of a sudden worked. I had just been messing around with the GLSL code, and hadn't changed anything about my `main.rs`. It took careful backstepping through my changes to realize that I had removed the `rbga8` part of the layout declaration. And I only found this because I thought, "Oh, I'm missing the image format here. Better add it back", which instantly gave me the error I experienced at the beginning of this odyssey. Only then did I realize that you don't have to specify an image format for Vulkan Compute Shaders (and possibly other shaders?). This is probably fundamental knowledge (or I'm pigeon-holing myself into a horrible unfixable situation later on when I need an image format to do something in the shader. If so, someone, please yell at me to let me know.) But if not, I hope this blog helps someone else going forward when they desperately google how to enable more image formats for their GPU.

