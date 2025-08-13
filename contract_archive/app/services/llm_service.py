"""
LLM服务 - 基于SiliconFlow API
调用Qwen2.5:8B模型进行AI回答生成
"""
import requests
import logging
import time
import json
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    """大语言模型服务"""
    
    def __init__(self):
        """初始化LLM服务"""
        self.api_key = settings.SILICONFLOW_API_KEY
        self.base_url = "https://api.siliconflow.cn/v1"
        self.model_name = "Qwen/Qwen2.5-7B-Instruct"  # 使用Qwen2.5-7B-Instruct模型
        
        logger.info("LLMService 初始化完成")
    
    def generate_response(
        self,
        question: str,
        context_chunks: List[Dict[str, Any]],
        max_tokens: int = 1000,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> Dict[str, Any]:
        """
        基于上下文生成AI回答
        
        Args:
            question: 用户问题
            context_chunks: 相关的上下文块
            max_tokens: 最大生成token数
            temperature: 随机性参数
            top_p: 核采样参数
            
        Returns:
            Dict: 生成结果和统计信息
        """
        start_time = time.time()
        
        try:
            # 构建提示词
            prompt = self._build_prompt(question, context_chunks)
            
            # 准备API请求
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的合同档案智能助手。请基于提供的合同内容，准确、详细地回答用户问题。如果提供的内容无法完全回答问题，请明确说明。"
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "stream": False
            }
            
            # 调用LLM API
            response = requests.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            llm_time = (time.time() - start_time) * 1000  # 转换为毫秒
            
            # 解析API响应
            if "choices" in result and len(result["choices"]) > 0:
                answer = result["choices"][0]["message"]["content"]
                finish_reason = result["choices"][0].get("finish_reason", "stop")
                
                # 提取token使用统计
                usage = result.get("usage", {})
                input_tokens = usage.get("prompt_tokens", 0)
                output_tokens = usage.get("completion_tokens", 0)
                total_tokens = usage.get("total_tokens", input_tokens + output_tokens)
                
                logger.info(f"LLM生成完成，问题: {question[:50]}..., 输入tokens: {input_tokens}, 输出tokens: {output_tokens}, 耗时: {llm_time:.2f}ms")
                
                return {
                    "status": "success",
                    "message": "AI回答生成成功",
                    "answer": answer,
                    "llm_model": self.model_name,
                    "llm_prompt": prompt,
                    "llm_input_tokens": input_tokens,
                    "llm_output_tokens": output_tokens,
                    "llm_total_tokens": total_tokens,
                    "llm_time": llm_time,
                    "finish_reason": finish_reason,
                    "generation_status": "completed",
                    "context_chunks_count": len(context_chunks)
                }
            else:
                return {
                    "status": "error",
                    "message": "LLM API响应格式异常",
                    "answer": "抱歉，生成回答时出现异常，请稍后重试。",
                    "llm_model": self.model_name,
                    "llm_time": llm_time,
                    "generation_status": "failed",
                    "error": "API响应格式异常"
                }
                
        except requests.exceptions.Timeout:
            llm_time = (time.time() - start_time) * 1000
            logger.error("LLM API调用超时")
            return {
                "status": "timeout", 
                "message": "AI回答生成超时",
                "answer": "抱歉，AI回答生成超时，请稍后重试。",
                "llm_model": self.model_name,
                "llm_time": llm_time,
                "generation_status": "timeout",
                "error": "API调用超时"
            }
            
        except requests.exceptions.RequestException as e:
            llm_time = (time.time() - start_time) * 1000
            logger.error(f"LLM API调用失败: {str(e)}")
            return {
                "status": "error",
                "message": f"AI回答生成失败: {str(e)}",
                "answer": "抱歉，AI服务暂时不可用，请稍后重试。",
                "llm_model": self.model_name,
                "llm_time": llm_time,
                "generation_status": "failed",
                "error": str(e)
            }
            
        except Exception as e:
            llm_time = (time.time() - start_time) * 1000
            logger.error(f"LLM处理失败: {str(e)}")
            return {
                "status": "error",
                "message": f"AI回答处理失败: {str(e)}",
                "answer": "抱歉，处理您的问题时出现异常，请稍后重试。",
                "llm_model": self.model_name,
                "llm_time": llm_time,
                "generation_status": "failed",
                "error": str(e)
            }
    
    def _build_prompt(self, question: str, context_chunks: List[Dict[str, Any]]) -> str:
        """
        构建LLM提示词
        
        Args:
            question: 用户问题
            context_chunks: 上下文块
            
        Returns:
            str: 构建的提示词
        """
        try:
            if not context_chunks:
                return f"""
用户问题：{question}

注意：当前没有找到相关的合同内容。请告知用户没有找到相关信息，并建议重新描述问题或使用其他关键词搜索。
"""
            
            # 构建上下文内容
            context_parts = []
            for i, chunk in enumerate(context_chunks, 1):
                contract_name = chunk.get("contract_name", "未知合同")
                contract_number = chunk.get("contract_number", "")
                content_text = chunk.get("content_text", "")
                chunk_index = chunk.get("chunk_index", i)
                
                # 限制每个块的长度
                if len(content_text) > 800:
                    content_text = content_text[:800] + "..."
                
                context_part = f"""
【内容块{i}】
合同名称：{contract_name}
合同编号：{contract_number}
块索引：{chunk_index}
内容：{content_text}
"""
                context_parts.append(context_part)
            
            context_text = "\n".join(context_parts)
            
            prompt = f"""
根据以下合同内容，回答用户问题。请确保回答基于提供的内容，准确且有条理。

相关合同内容：
{context_text}

用户问题：{question}

回答要求：
1. 基于提供的合同内容进行回答
2. 回答要准确、具体、有条理
3. 如果内容不足以完全回答问题，请明确说明
4. 在回答中引用相关的合同名称和内容
5. 保持专业和礼貌的语气
"""
            
            return prompt
            
        except Exception as e:
            logger.error(f"构建提示词失败: {str(e)}")
            return f"用户问题：{question}\n\n注意：构建上下文时出现错误，请基于问题本身回答。"
    
    def generate_simple_response(self, question: str) -> Dict[str, Any]:
        """
        生成简单回答（无上下文）
        
        Args:
            question: 用户问题
            
        Returns:
            Dict: 生成结果
        """
        return self.generate_response(
            question=question,
            context_chunks=[],
            max_tokens=500,
            temperature=0.7
        )

# 创建全局服务实例
llm_service = LLMService()