chat-new = New chat
chat-recent = Recent
chat-placeholder = Ask anything
chat-empty = What can I help with?
chat-message = Message
chat-send = Send
chat-stop = Stop
sidebar-open = Open sidebar
sidebar-close = Close sidebar

prompt-draw = How does Tessera draw this page?
prompt-model = What is a model?
prompt-shader = Can I write my own shader?
prompt-fast = What makes Tessera fast?

title-draw = How it draws
title-model = Models and state
title-shader = Custom shaders
title-fast = Why it is fast

answer-draw = Everything you see here is drawn by Tessera on the GPU. Components describe layout and drawing, the renderer batches their draw commands, and wgpu submits them, which in your browser means WebGPU. There is no DOM under this chat: every bubble, glyph and ripple is a draw command.
answer-model = A model groups the data and operations of a screen. Fields the UI reads are State handles, other fields are plain data changed by methods. This chat is one: the conversations are a State, and the task streaming this reply is a plain field, so starting a new reply cancels the old one.
answer-shader = Yes. Every effect in Tessera is a pluggable WGSL pipeline, the built-in components included. A component records a typed draw command, and the pipeline you register draws it. Shaders can also sample the scene behind them, which is how blur and glass work.
answer-fast = Tessera rebuilds only the components that read changed state, keeps layout results when their inputs are unchanged, and redraws without rebuilding when only paint changed. While this reply streams, only the message that grows is rebuilt each frame.
answer-fallback = This demo answers from a short script, so it can't really think. Everything around the answer is real, though: the text field, the buttons, the scrolling list and the frame-by-frame streaming all run in WebAssembly and draw with WebGPU. Try one of the suggestions in a new chat.
