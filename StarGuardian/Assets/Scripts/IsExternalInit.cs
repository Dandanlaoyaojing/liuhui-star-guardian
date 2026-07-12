// C# 9 的 `init` 访问器在 Unity 的 netstandard 目标下需要 System.Runtime.CompilerServices.IsExternalInit
// (Unity 运行时不自带) → 定义这个空类型, 让全库 `{ get; init; }` 属性能在 Unity 编译。
//
// 放在 Assets/Scripts/ 根目录(非 Core/Interaction 子目录)是有意的: dotnet 测试工程(net10, 自带 IsExternalInit)
// 只 glob Core/** 与 Interaction/**, 不会编到本文件, 因此不会与 net10 内建类型冲突; 而 Unity 编译整个 Assets,
// 会拿到这份 polyfill。别把它移进 Core/ 或 Interaction/, 否则 dotnet 侧会重复定义。
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit { }
}
