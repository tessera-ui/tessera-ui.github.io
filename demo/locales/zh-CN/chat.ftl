chat-new = 新对话
chat-recent = 最近
chat-placeholder = 有问题，尽管问
chat-empty = 有什么可以帮你？
chat-message = 消息
chat-send = 发送
chat-stop = 停止
sidebar-open = 打开侧栏
sidebar-close = 关闭侧栏

prompt-draw = Tessera 是怎么绘制这个页面的？
prompt-model = 什么是模型？
prompt-shader = 可以自己写着色器吗？
prompt-fast = 是什么让 Tessera 这么快？

title-draw = 绘制原理
title-model = 模型与状态
title-shader = 自定义着色器
title-fast = 为什么快

answer-draw = 你在这里看到的一切都由 Tessera 在 GPU 上绘制。组件描述布局和绘制，渲染器把它们的绘制命令合批，再交给 wgpu 提交，在浏览器里也就是 WebGPU。这个聊天界面下面没有 DOM：每个气泡、每个字形、每道涟漪都是一条绘制命令。
answer-model = 模型把一个页面的数据和操作组织在一起。界面要读取的字段是 State 句柄，其他字段是由方法修改的普通数据。这个聊天界面本身就是一个模型：会话列表是一个 State，正在输出这条回复的任务是一个普通字段，所以开始新的回复会取消旧的。
answer-shader = 可以。Tessera 的每种效果都是可插拔的 WGSL 管线，内置组件也不例外。组件记录一条带类型的绘制命令，由你注册的管线来绘制。着色器还能采样它背后的画面，模糊和玻璃效果就是这样实现的。
answer-fast = Tessera 只重建读取了变化状态的组件，输入不变时沿用布局结果，只有绘制变化时直接重绘而不重建。这条回复逐字输出时，每一帧只重建正在变长的这条消息。
answer-fallback = 这个演示按一份简短的脚本回答，并不会真正思考。不过回答周围的一切都是真的：输入框、按钮、滚动列表和逐帧输出，都运行在 WebAssembly 中，并通过 WebGPU 绘制。在新对话里试试推荐的问题吧。
