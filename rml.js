let NEXT_RENDER = {
    raw: '',
    nodes: [],
};

const initRML = (data) => {
    const parser = new DOMParser();
    const body = document.body.innerHTML;

    const doc = parser.parseFromString(body, 'text/html');
    const loaded = doc.querySelectorAll('*');
    
    NEXT_RENDER = {
        raw: body,
        nodes: [
            ...loaded,
        ],
    };

    useRML(data);
};

const useRML = (data) => {
    const funcInstanceOrDefault = (action, check) => {
        return (typeof check === 'function') ? check : console.log(`${action} on ${check} is not a function!`);
    };

    const updateElem = (elem, prop, val, store) => {
        if (elem.hasAttribute(`*${prop}`)) {
            elem.setAttribute(prop, store[val]);
        }
    };

    const bindAttrToValue = (elem, obj, bound, store) => {
        if (!elem.hasAttribute('attached')) {
            elem.addEventListener('keyup', (evt) => {
                store[obj] = elem.getAttribute(bound);
            });
            elem.setAttribute('attached', true);
        }
        updateElem(elem, bound, obj, store);
    };

    const updateDOM = (store, renderer) => {
        if (renderer) {
            document.body.innerHTML = renderer.raw;
        }

        document.querySelectorAll('*').forEach((elem) => {
            elem.getAttributeNames().forEach((attr) => {
                if (attr.startsWith('@')) {
                    const action = attr.substring(1);
                    elem.addEventListener(action, funcInstanceOrDefault(action, store[elem.getAttribute(attr)]));
                }
    
                if (attr.startsWith('*')) {
                    const binder = attr.substring(1);
                    const bound = elem.getAttribute(attr);
                    bindAttrToValue(elem, bound, binder, store);
                }
    
                if (attr.startsWith('%')) {
                    const keyword = attr.substring(1).toLowerCase().trim();

                    switch (keyword) {
                        case 'rml':
                            handleRMLTemplatedStrings(elem, attr, store);
                            break;
                        case 'if':
                            handleIf(elem, attr, store);
                            break;
                        case 'for':                       
                            handleFor(elem, attr, store);
                            break;
                    }
                }
            });
        });
    };

    const handleRMLTemplatedStrings = (elem, attr, store) => {
        Object.keys(store).forEach((obj) => {
            elem.textContent = elem.textContent.replace(/\s/g, '').replaceAll(`{{${obj}}}`, store[obj]);
        });
    };

    const handleIf = (elem, attr, store) => {
        if (elem.hasAttribute('%if')) {
            let conditional = elem.getAttribute(attr).replace(/\s/g, '');

            Object.keys(store).forEach((obj) => {
                if (conditional.includes(`{{${obj.trim()}`)) {
                    const objChain = conditional.split(`{{${obj.trim()}.`);
                    if (objChain.length > 1) {
                        conditional = conditional.replace(`{{${obj.trim()}`, `store['${obj}']`).replace('}}', '');
                    } else {
                        conditional = conditional.replaceAll(`{{${obj.trim()}}}`, `store['${obj}']`);
                    }
                }
            });

            const expr = eval(conditional);
            if (typeof expr === 'boolean') {
                let elseExpr;

                const children = elem.children;
                for (const child of children) {
                    if (child && child.hasAttribute('%else')) {
                        elseExpr = child;
                    }
                }

                if (!expr) {
                    if (elseExpr) {
                        elem.parentElement.appendChild(elseExpr);
                    }
                    elem.remove();
                } else {
                    if (elseExpr) {
                        elseExpr.remove();
                    }
                }
            }
        }
    };  

    const handleFor = (elem, attr, store) => {
        const subAs = elem.getAttribute(':as');
        const subKey = elem.getAttribute(':key');
        const iteratorAttr = elem.getAttribute(attr);
    
        if (!subAs || !subKey) {
            return;
        }
    
        const elems = [];
        const children = elem.children;
        for (const child of children) {
            elems.push(child);
        }
    
        const iterator = store[iteratorAttr] || [];

        for (const childToIterate of elems) {
            if (childToIterate.hasAttribute('static') || childToIterate.children.length > 0) {
                const childs = [];
                const iteratedChildren = childToIterate.children;
                for (const iChild of iteratedChildren) {
                    childs.push(iChild);
                }
                for (const kid of childs) {
                    const parentClone = kid.parentElement.cloneNode(false);

                    if (iterator.length <= 0) {
                        childToIterate.remove();
                    }

                    for (const iter of iterator) {
                        const cloned = kid.cloneNode(true);
                        childToIterate.remove();
                        kid.remove();                   
            
                        if (cloned.attributes) {
                            for (const [idx, localAttr] of Object.entries(cloned.attributes)) {
                                cloned.attributes[idx].textContent = localAttr.textContent.replace(/\s/g, '').replace(`{{${subAs}}}`, iter);
                            }
                        }

                        cloned.textContent = kid.textContent.replace(/\s/g, '').replace(`{{${subAs}}}`, iter);
                        parentClone.appendChild(cloned);
                        elem.appendChild(parentClone);
                    }
                }
            } else {
                if (iterator.length <= 0) {
                    childToIterate.remove();
                }

                for (const iter of iterator) {
                    const cloned = childToIterate.cloneNode(true);
                    childToIterate.remove();
                                        
                    if (cloned.attributes) {
                        for (const [idx, localAttr] of Object.entries(cloned.attributes)) {
                            cloned.attributes[idx].textContent = localAttr.textContent.replace(/\s/g, '').replace(`{{${subAs}}}`, iter);
                        }
                    }

                    cloned.textContent = childToIterate.textContent.replace(/\s/g, '').replace(`{{${subAs}}}`, iter);
                    elem.appendChild(cloned);
                }
            }
        }

        const parsedElems = elem.querySelectorAll('*');

        for (const e of parsedElems) {
            handleIf(e, '%if', store);
        }
    };

    const oldStore = {
        ...data.store
    };    

    updateDOM(data.store);

    Object.keys(data.store).forEach(obj => {
        if (Array.isArray(data.store[obj])) {
            const oldPush = data.store[obj].push;
            data.store[obj].push = function() {
                for (let i = 0; i < arguments.length; i++) {
                    data.store[obj] = [
                        ...data.store[obj],
                        ...arguments,
                    ];
                    oldPush.apply(this, arguments);
                }
            }

            const oldPop = data.store[obj].pop;
            data.store[obj].pop = function() {
                data.store[obj] = data.store[obj].splice(this.length - 1, 1);
                oldPop.apply(this, arguments);
            }
        }

        Object.defineProperty(data.store, obj, {
            get: () => {
                return oldStore[obj];
            },
            set: (val) => {
                newStore = {
                    ...oldStore,   
                };
                newStore[obj] = val;

                updateDOM(newStore, NEXT_RENDER);
            },
        });
    });
};