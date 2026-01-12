/**
 * 数据导出工具类
 */

/**
 * 将对象数组转换为 CSV 字符串
 * @param {Array} data - 数据数组
 * @param {Object} columns - 列映射 { field: label }
 */
export const convertToCSV = (data, columns) => {
    if (!data || data.length === 0) return '';

    const headers = Object.values(columns);
    const fields = Object.keys(columns);

    const rows = data.map(item => {
        return fields.map(field => {
            let value = item[field];
            if (value === null || value === undefined) value = '';
            // 处理包含逗号、双引号或换行的字段
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

/**
 * 触发浏览器下载
 * @param {string} content - 内容
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型
 */
export const downloadFile = (content, fileName, mimeType = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([`\uFEFF${content}`], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * 导出 JSON 备份
 * @param {Object} data - 数据包
 */
export const downloadBackupJSON = (data) => {
    const content = JSON.stringify(data, null, 2);
    const fileName = `carnote_backup_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(content, fileName, 'application/json');
};
