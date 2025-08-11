"""
Elasticsearch搜索服务
提供快速的关键词检索和全文搜索功能
"""
import json
import logging
from typing import List, Dict, Any, Optional
from app.config import settings
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError, RequestError
import jieba
import jieba.analyse

logger = logging.getLogger(__name__)

class ElasticsearchService:
    """Elasticsearch搜索服务类"""
    
    def __init__(self):
        self.enabled = settings.ELASTICSEARCH_ENABLED
        self.host = settings.ELASTICSEARCH_HOST
        self.port = settings.ELASTICSEARCH_PORT
        
        if not self.enabled:
            logger.info("Elasticsearch 功能已禁用")
            self.client = None
            return
            
        try:
            self.client = Elasticsearch(
                [f"http://{self.host}:{self.port}"],
                timeout=30,
                max_retries=3,
                retry_on_timeout=True
            )
            
            # 测试连接
            if self.client.ping():
                logger.info("Elasticsearch 连接成功")
                self._create_indices()
            else:
                logger.error("无法连接到 Elasticsearch")
                self.client = None
                self.enabled = False
        except Exception as e:
            logger.error(f"Elasticsearch 初始化失败: {e}")
            self.client = None
            self.enabled = False

    
    def _create_indices(self):
        """创建索引和映射"""
        try:
            # 合同索引映射
            contract_mapping = {
                "mappings": {
                    "properties": {
                        "contract_id": {"type": "integer"},
                        "contract_number": {"type": "keyword"},
                        "contract_name": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "contract_type": {"type": "keyword"},
                        "keywords": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "summary": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "file_name": {"type": "keyword"},
                        "upload_time": {"type": "date"},
                        "created_at": {"type": "date"}
                    }
                }
            }
            
            # 内容块索引映射
            content_mapping = {
                "mappings": {
                    "properties": {
                        "chunk_id": {"type": "integer"},
                        "contract_id": {"type": "integer"},
                        "contract_number": {"type": "keyword"},
                        "contract_name": {"type": "keyword"},
                        "file_name": {"type": "keyword"},
                        "file_format": {"type": "keyword"},
                        "upload_time": {"type": "date"},
                        "contract_type": {"type": "keyword"},
                        "chunk_index": {"type": "integer"},
                        "content_text": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "chunk_type": {"type": "keyword"},
                        "chunk_size": {"type": "integer"},
                        "created_at": {"type": "date"}
                    }
                }
            }
            
            # 创建索引（如果不存在）
            if not self.client.indices.exists(index="contracts"):
                self.client.indices.create(index="contracts", body=contract_mapping)
                logger.info("创建索引: contracts")
            
            if not self.client.indices.exists(index="contract_contents"):
                self.client.indices.create(index="contract_contents", body=content_mapping)
                logger.info("创建索引: contract_contents")
                
        except Exception as e:
            logger.error(f"创建索引失败: {str(e)}")
    
    def is_available(self) -> bool:
        """检查 Elasticsearch 服务是否可用"""
        return self.enabled and self.client is not None
    
    def create_contracts_index(self) -> bool:
        """创建合同索引"""
        if not self.is_available():
            return False
        
        try:
            contract_mapping = {
                "mappings": {
                    "properties": {
                        "contract_id": {"type": "integer"},
                        "contract_number": {"type": "keyword"},
                        "contract_name": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "contract_type": {"type": "keyword"},
                        "keywords": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "summary": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "file_name": {"type": "keyword"},
                        "upload_time": {"type": "date"},
                        "created_at": {"type": "date"}
                    }
                }
            }
            
            if not self.client.indices.exists(index="contracts"):
                self.client.indices.create(index="contracts", body=contract_mapping)
                logger.info("创建索引: contracts")
                return True
            else:
                logger.info("索引 contracts 已存在")
                return False
                
        except Exception as e:
            logger.error(f"创建合同索引失败: {str(e)}")
            return False
    
    def create_contract_contents_index(self) -> bool:
        """创建内容索引"""
        if not self.is_available():
            return False
        
        try:
            content_mapping = {
                "mappings": {
                    "properties": {
                        "chunk_id": {"type": "integer"},
                        "contract_id": {"type": "integer"},
                        "contract_number": {"type": "keyword"},
                        "contract_name": {"type": "keyword"},
                        "file_name": {"type": "keyword"},
                        "file_format": {"type": "keyword"},
                        "upload_time": {"type": "date"},
                        "contract_type": {"type": "keyword"},
                        "chunk_index": {"type": "integer"},
                        "content_text": {
                            "type": "text",
                            "analyzer": "standard"
                        },
                        "chunk_type": {"type": "keyword"},
                        "chunk_size": {"type": "integer"},
                        "created_at": {"type": "date"}
                    }
                }
            }
            
            if not self.client.indices.exists(index="contract_contents"):
                self.client.indices.create(index="contract_contents", body=content_mapping)
                logger.info("创建索引: contract_contents")
                return True
            else:
                logger.info("索引 contract_contents 已存在")
                return False
                
        except Exception as e:
            logger.error(f"创建内容索引失败: {str(e)}")
            return False
    
    def index_contract(self, contract_data: Dict[str, Any]) -> bool:
        """索引合同文档"""
        if not self.is_available():
            logger.warning("Elasticsearch不可用，跳过索引")
            return False
        
        try:
            # 提取关键词
            contract_text = f"{contract_data.get('contract_name', '')} {contract_data.get('summary', '')}"
            keywords = self._extract_keywords(contract_text)
            
            # 准备索引数据
            doc = {
                "contract_id": contract_data["id"],
                "contract_number": contract_data["contract_number"],
                "contract_name": contract_data["contract_name"],
                "contract_type": contract_data.get("contract_type"),
                "keywords": " ".join(keywords),
                "summary": contract_data.get("summary", ""),
                "file_name": contract_data["file_name"],
                "upload_time": contract_data["upload_time"],
                "created_at": contract_data["created_at"]
            }
            
            # 索引文档
            doc_id = f"contract_{contract_data['id']}"
            self.client.index(
                index="contracts",
                id=doc_id,
                body=doc
            )
            
            logger.info(f"成功索引合同: {contract_data['contract_number']}")
            return True
            
        except Exception as e:
            logger.error(f"索引合同失败: {str(e)}")
            return False
    
    def index_content_chunk(self, chunk_data: Dict[str, Any], contract_info: Dict[str, Any]) -> bool:
        """索引内容块"""
        if not self.is_available():
            logger.warning("Elasticsearch不可用，跳过索引")
            return False
        
        try:
            # 准备索引数据
            doc = {
                "chunk_id": chunk_data["id"],
                "contract_id": chunk_data["contract_id"],
                "contract_number": contract_info["contract_number"],
                "contract_name": contract_info["contract_name"],
                "file_name": contract_info.get("file_name", ""),
                "file_format": contract_info.get("file_format", ""),
                "upload_time": contract_info.get("upload_time"),
                "contract_type": contract_info.get("contract_type", ""),
                "chunk_index": chunk_data["chunk_index"],
                "content_text": chunk_data["content_text"],
                "chunk_type": chunk_data.get("chunk_type", "text"),
                "chunk_size": chunk_data.get("chunk_size", 0),
                "created_at": chunk_data["created_at"]
            }
            
            # 索引文档
            doc_id = f"chunk_{chunk_data['id']}"
            self.client.index(
                index="contract_contents",
                id=doc_id,
                body=doc
            )
            
            logger.info(f"成功索引内容块: {chunk_data['id']}")
            return True
            
        except Exception as e:
            logger.error(f"索引内容块失败: {str(e)}")
            return False
    
    async def search_contracts(self, query: str, search_type: str = "keyword", size: int = 10) -> Dict[str, Any]:
        """异步版本的搜索合同方法，用于qa_sessions.py"""
        # 先搜索合同
        contract_results = self.search_contracts_sync(query, search_type, size)
        
        # 如果是hybrid搜索，还需要搜索内容块
        if search_type == "hybrid" and contract_results["hits"]["hits"]:
            # 获取找到的合同ID
            contract_ids = [hit["_source"]["contract_id"] for hit in contract_results["hits"]["hits"]]
            
            # 搜索相关内容块
            content_results = self.search_content(query, contract_ids, size)
            
            # 合并结果，将内容块结果添加到合同结果中
            combined_hits = []
            
            # 添加合同结果
            for hit in contract_results["hits"]["hits"]:
                combined_hits.append(hit)
            
            # 添加内容块结果（转换格式）
            for content in content_results[:size//2]:  # 限制内容块数量
                content_hit = {
                    "_source": {
                        "contract_id": content["contract_id"],
                        "chunk_id": content["chunk_id"],
                        "contract_name": content["contract_name"],
                        "contract_number": content["contract_number"],
                        "content_text": content["content_text"][:200],  # 截取前200字符
                        "chunk_index": content["chunk_index"]
                    },
                    "_score": content["score"],
                    "highlight": content.get("highlights", {})
                }
                combined_hits.append(content_hit)
            
            # 更新结果
            contract_results["hits"]["hits"] = combined_hits[:size]
            contract_results["hits"]["total"]["value"] = len(combined_hits)
        
        return contract_results
    
    def search_contracts_sync(self, query: str, search_type: str = "keyword", size: int = 10) -> Dict[str, Any]:
        """同步版本的搜索合同方法"""
        if not self.is_available():
            logger.warning("Elasticsearch不可用，返回空结果")
            return {"hits": {"hits": [], "total": {"value": 0}}}
        
        try:
            # 根据搜索类型构建不同的查询（复用之前的逻辑）
            if search_type == "semantic":
                search_body = {
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": [
                                "contract_name^3",
                                "keywords^2",
                                "summary^2",
                                "contract_type"
                            ],
                            "type": "cross_fields",
                            "fuzziness": "AUTO"
                        }
                    },
                    "highlight": {
                        "fields": {
                            "contract_name": {},
                            "keywords": {},
                            "summary": {}
                        }
                    },
                    "size": size
                }
            elif search_type == "hybrid":
                search_body = {
                    "query": {
                        "bool": {
                            "should": [
                                {
                                    "multi_match": {
                                        "query": query,
                                        "fields": [
                                            "contract_name^3",
                                            "contract_number^2",
                                            "keywords^2"
                                        ],
                                        "type": "best_fields",
                                        "boost": 2.0
                                    }
                                },
                                {
                                    "multi_match": {
                                        "query": query,
                                        "fields": ["summary", "contract_type"],
                                        "type": "cross_fields",
                                        "fuzziness": "AUTO",
                                        "boost": 1.0
                                    }
                                }
                            ]
                        }
                    },
                    "highlight": {
                        "fields": {
                            "contract_name": {},
                            "keywords": {},
                            "summary": {}
                        }
                    },
                    "size": size
                }
            else:
                search_body = {
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": [
                                "contract_name^3",
                                "contract_number^2",
                                "keywords^2",
                                "summary",
                                "contract_type"
                            ],
                            "type": "best_fields",
                            "fuzziness": "AUTO"
                        }
                    },
                    "highlight": {
                        "fields": {
                            "contract_name": {},
                            "keywords": {},
                            "summary": {}
                        }
                    },
                    "size": size
                }
            
            response = self.client.search(
                index="contracts",
                body=search_body
            )
            
            logger.info(f"搜索合同完成，找到 {response['hits']['total']['value']} 个结果")
            return response
            
        except Exception as e:
            logger.error(f"搜索合同失败: {str(e)}")
            return {"hits": {"hits": [], "total": {"value": 0}}}
    
    def search_content(self, query: str, contract_ids: List[int] = None, limit: int = 20) -> Dict[str, Any]:
        """搜索内容块"""
        if not self.is_available():
            logger.warning("Elasticsearch不可用，返回空结果")
            return {"hits": {"hits": [], "total": {"value": 0}}}
        
        try:
            # 构建搜索查询
            search_body = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": [
                                        "content_text^2",
                                        "contract_name",
                                        "contract_number"
                                    ],
                                    "type": "best_fields",
                                    "fuzziness": "AUTO"
                                }
                            }
                        ]
                    }
                },
                "highlight": {
                    "fields": {
                        "content_text": {
                            "fragment_size": 150,
                            "number_of_fragments": 3
                        },
                        "contract_name": {},
                        "contract_number": {}
                    }
                },
                "sort": [
                    {"_score": {"order": "desc"}},
                    {"chunk_index": {"order": "asc"}}
                ],
                "size": limit
            }
            
            # 如果指定了合同ID，添加过滤条件
            if contract_ids:
                if "bool" not in search_body["query"]:
                    search_body["query"] = {
                        "bool": {
                            "must": [search_body["query"]]
                        }
                    }
                search_body["query"]["bool"]["filter"] = [
                    {"terms": {"contract_id": contract_ids}}
                ]
            
            # 执行搜索
            response = self.client.search(
                index="contract_contents",
                body=search_body
            )
            
            logger.info(f"搜索内容完成，找到 {response['hits']['total']['value']} 个结果")
            return response
            
        except Exception as e:
            logger.error(f"搜索内容失败: {str(e)}")
            return {"hits": {"hits": [], "total": {"value": 0}}}
    
    def _extract_keywords(self, text: str, topK: int = 10) -> List[str]:
        """提取关键词"""
        try:
            # 使用 jieba 提取关键词
            keywords = jieba.analyse.extract_tags(text, topK=topK, withWeight=False)
            return keywords
        except Exception as e:
            logger.error(f"关键词提取失败: {e}")
            return []
    
    def delete_contract(self, contract_id: int) -> bool:
        """删除合同索引"""
        if not self.is_available():
            return False
        
        try:
            # 删除合同文档
            contract_doc_id = f"contract_{contract_id}"
            try:
                self.client.delete(index="contracts", id=contract_doc_id)
            except NotFoundError:
                pass
            
            # 删除相关内容块
            self.client.delete_by_query(
                index="contract_contents",
                body={
                    "query": {
                        "term": {"contract_id": contract_id}
                    }
                }
            )
            
            logger.info(f"成功删除合同索引: {contract_id}")
            return True
            
        except Exception as e:
            logger.error(f"删除合同索引失败: {str(e)}")
            return False

# 全局实例
elasticsearch_service = ElasticsearchService()
# Trigger reload
