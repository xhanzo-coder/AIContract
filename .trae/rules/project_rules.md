# 禁止执行`pip`命令，需要执行时告诉我，我手动执行，不要自己执行。


# 规则：
1. 所有测试文件在测试结束后都需要删掉
2. 在讨论解决方案前不要写任何的代码
3. 所有的python环境都是在miniconda中的`myproj`虚拟环境下运行的，不要使用错误的python环境，每次在安装python包到的时候都需要检查一遍，不要安装运行在错误的python环境下了。
4. PowerShell不支持 && 语法，每次执行命令的时候请分步骤执行。
5. 每次开启后端服务时，只需要激活`myproj`虚拟环境，然后在到`contract_archive`目录下执行`python run.py`即可开启后端服务。不要每次都在错误的环境下安装库再运行！
# 重点：
1. 每次执行后端代码时，若报错`ModuleNotFoundError: No module named 'xxx'`，请检查当前是否在`myproj`虚拟环境下，而不是给我安装对应的库！！！！！

